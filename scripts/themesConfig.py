#!/bin/python

# Copyright 2017-2024 Sourcepole AG
# All rights reserved.
#
# This source code is licensed under the BSD-style license found in the
# LICENSE file in the root directory of this source tree.

import os
try:
    from urllib import request
except:
    import urllib2 as request
try:
    from urllib.parse import quote, urljoin, urlparse, parse_qsl, urlencode, urlunparse
except:
    from urllib import quote
    from urlparse import urljoin
from xml.dom.minidom import parseString
import json
import traceback
import socket
import re
import uuid

baseUrl = "http://" + socket.getfqdn()
qwc2_path = "."
themesConfig = os.environ.get("QWC2_THEMES_CONFIG", "themesConfig.json")

usedThemeIds = []
autogenExternalLayers = []

def uniqueThemeId(themeName):
    if not themeName:
        return str(uuid.uuid1())
    if themeName in usedThemeIds:
        i = 1
        while ("%s%d") % (themeName, i) in usedThemeIds:
            i += 1
        usedThemeIds.append(("%s%d") % (themeName, i))
        return usedThemeIds[-1]
    else:
        usedThemeIds.append(themeName)
        return usedThemeIds[-1]


def getUrlOpener(configItem):
    auth = configItem.get('wmsBasicAuth')
    if auth:
        manager = request.HTTPPasswordMgrWithDefaultRealm()
        manager.add_password(None, configItem["url"], auth['username'], auth['password'])
        auth_handler = request.HTTPBasicAuthHandler(manager)
        opener = request.build_opener(auth_handler).open
    else:
        opener = request.urlopen
    return opener

def update_params(url,params):
    url_parse = urlparse(url)
    query = url_parse.query
    url_dict = dict(parse_qsl(query))
    url_dict.update(params)
    url_new_query = urlencode(url_dict)
    new_url = url_parse._replace(query=url_new_query).geturl()
    return new_url

# load thumbnail from file or GetMap
def getThumbnail(configItem, resultItem, layers, crs, extent):
    if "thumbnail" in configItem:
        if os.path.exists(qwc2_path + "/static/assets/img/mapthumbs/" + configItem["thumbnail"]):
            resultItem["thumbnail"] = "img/mapthumbs/" + configItem["thumbnail"]
            return

    print("Using WMS GetMap to generate thumbnail for " + configItem["url"])

    # WMS GetMap request
    url = update_params(urljoin(baseUrl, configItem["url"]), {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'FORMAT': 'image/png', 'STYLES': '', 'WIDTH': '200', 'HEIGHT': '100', 'CRS': crs})
    bboxw = extent[2] - extent[0]
    bboxh = extent[3] - extent[1]
    bboxcx = 0.5 * (extent[0] + extent[2])
    bboxcy = 0.5 * (extent[1] + extent[3])
    imgratio = 200. / 100.
    if bboxw > bboxh:
        bboxratio = bboxw / bboxh
        if bboxratio > imgratio:
            bboxh = bboxw / imgratio
        else:
            bboxw = bboxh * imgratio
    else:
        bboxw = bboxh * imgratio
    adjustedExtent = [bboxcx - 0.5 * bboxw, bboxcy - 0.5 * bboxh,
                      bboxcx + 0.5 * bboxw, bboxcy + 0.5 * bboxh]
    url += "&BBOX=" + (",".join(map(str, adjustedExtent)))
    url += "&LAYERS=" + quote(",".join(layers).encode('utf-8'))

    try:
        opener = getUrlOpener(configItem)
        reply = opener(url).read()
        basename = configItem["url"].rsplit("/")[-1].rstrip("?") + ".png"
        try:
            os.makedirs(qwc2_path + "/static/assets/img/genmapthumbs/")
        except Exception as e:
            if not isinstance(e, FileExistsError): raise e
        thumbnail = qwc2_path + "/static/assets/img/genmapthumbs/" + basename
        with open(thumbnail, "wb") as fh:
            fh.write(reply)
        resultItem["thumbnail"] = "img/genmapthumbs/" + basename
    except Exception as e:
        print("ERROR generating thumbnail for WMS " + configItem["url"] + ":\n" + str(e))
        resultItem["thumbnail"] = "img/mapthumbs/default.jpg"
        traceback.print_exc()

def getEditConfig(editConfig):
    if not editConfig:
        return None
    elif isinstance(editConfig, dict):
        return editConfig
    elif os.path.isabs(editConfig) and os.path.exists(editConfig):
        with open(editConfig, encoding='utf-8') as fh:
            config = json.load(fh)
        return config
    else:
        dirname = os.path.dirname(themesConfig)
        if not dirname:
            dirname = "."
        filename = os.path.join(dirname, editConfig)
        if os.path.exists(filename):
            with open(filename, encoding='utf-8') as fh:
                config = json.load(fh)
            return config
    return None

def getDirectChildElements(parent, tagname):
    return [node for node in parent.childNodes if node.nodeName.split(':')[-1] == tagname]


def getChildElement(parent, path):
    for part in path.split("/"):
        for node in parent.childNodes:
            if node.nodeName.split(':')[-1] == part:
                parent = node
                break
        else:
            return None
    return parent


def getElementValue(element):
    return element.firstChild.nodeValue if element and element.firstChild else ""


def getChildElementValue(parent, path):
    return getElementValue(getChildElement(parent, path))


# recursively get layer tree
def getLayerTree(layer, resultLayers, visibleLayers, printLayers, level, collapseBelowLevel, titleNameMap, featureReports, externalLayers):
    name = getChildElementValue(layer, "Name")
    title = getChildElementValue(layer, "Title")
    layers = getDirectChildElements(layer, "Layer")
    treeName = getChildElementValue(layer, "TreeName")


    # skip print layers
    for printLayer in printLayers:
        if type(printLayer) is list:
            for entry in printLayer:
                if entry["name"] == name:
                    return
        elif printLayer == name:
            return

    layerEntry = {"name": name, "title": title}

    if not layers:
        if layer.getAttribute("geometryType") == "WKBNoGeometry" or layer.getAttribute("geometryType") == "NoGeometry":
            # skip layers without geometry
            return

        # layer
        layerEntry["geometryType"] = layer.getAttribute("geometryType")
        if layer.getAttribute("visibilityChecked") != "":
            layerEntry["visibility"] = layer.getAttribute("visibilityChecked") == "1"
        else:
            layerEntry["visibility"] = layer.getAttribute("visible") == "1"
        if layerEntry["visibility"]:
            # collect visible layers
            visibleLayers.append(name)

        layerEntry["queryable"] = layer.getAttribute("queryable") == "1"
        if layerEntry["queryable"] and layer.getAttribute("displayField"):
            layerEntry["displayField"] = layer.getAttribute("displayField")

        try:
            onlineResource = getChildElement(layer, "Attribution/OnlineResource")
            layerEntry["attribution"] = {
                "Title": getChildElementValue(layer, "Attribution/Title"),
                "OnlineResource": onlineResource.getAttribute("xlink:href") if onlineResource else ""
            }
        except:
            pass
        try:
            layerEntry["abstract"] = getChildElementValue(layer, "Abstract")
        except:
            pass
        try:
            onlineResource = getChildElement(layer, "DataURL/OnlineResource")
            layerEntry["dataUrl"] = onlineResource.getAttribute("xlink:href")
            if layerEntry["dataUrl"].startswith("wms:"):
                externalLayers.append({"internalLayer": name, "name": layerEntry["dataUrl"]})
                layerEntry["dataUrl"] = ""
        except:
            pass
        try:
            onlineResource = getChildElement(layer, "MetadataURL/OnlineResource")
            layerEntry["metadataUrl"] = onlineResource.getAttribute("xlink:href")
        except:
            pass
        try:
            keywords = []
            for keyword in getChildElement(layer, "KeywordList").getElementsByTagName("Keyword"):
                keywords.append(getElementValue(keyword))
            layerEntry["keywords"] = ", ".join(keywords)
        except:
            pass
        
        styles = {}
        for style in layer.getElementsByTagName("Style"):
            name = getChildElementValue(style, "Name")
            title = getChildElementValue(style, "Title")
            styles[name] = title
        layerEntry["styles"] = styles
        layerEntry['style'] = 'default' if 'default' in styles else (list(styles)[0] if len(styles) > 0 else '')

        if layer.getAttribute("transparency"):
            layerEntry["opacity"] = 255 - int(float(layer.getAttribute("transparency")) * 255)
        elif layer.getAttribute("opacity"):
            layerEntry["opacity"] = int(float(layer.getAttribute("opacity")) * 255)
        else:
            layerEntry["opacity"] = 255
        minScale = getChildElementValue(layer, "MinScaleDenominator")
        maxScale = getChildElementValue(layer, "MaxScaleDenominator")
        if minScale and maxScale:
            layerEntry["minScale"] = int(float(minScale))
            layerEntry["maxScale"] = int(float(maxScale))
        # use geographic bounding box, as default CRS may have inverted axis order with WMS 1.3.0
        geoBBox = getChildElement(layer, "EX_GeographicBoundingBox")
        if geoBBox:
            layerEntry["bbox"] = {
                "crs": "EPSG:4326",
                "bounds": [
                    float(getChildElementValue(geoBBox, "westBoundLongitude")),
                    float(getChildElementValue(geoBBox, "southBoundLatitude")),
                    float(getChildElementValue(geoBBox, "eastBoundLongitude")),
                    float(getChildElementValue(geoBBox, "northBoundLatitude"))
                ]
            }
        if name in featureReports:
            layerEntry["featureReport"] = featureReports[name]

        layerEntry["dimensions"] = []
        for dim in getDirectChildElements(layer, "Dimension"):
            layerEntry["dimensions"].append({
                "units": dim.getAttribute("units"),
                "name": dim.getAttribute("name"),
                "multiple": dim.getAttribute("multipleValues") == "1",
                "value": getElementValue(dim),
                "fieldName": dim.getAttribute("fieldName"),
                "endFieldName": dim.getAttribute("endFieldName")
            })

    else:
        # group
        layerEntry["mutuallyExclusive"] = layer.getAttribute("mutuallyExclusive") == "1"
        if layer.getAttribute("visibilityChecked") != "":
            layerEntry["visibility"] = layer.getAttribute("visibilityChecked") == "1"
        else:
            layerEntry["visibility"] = layer.getAttribute("visible") == "1"
        layerEntry["sublayers"] = []
        if layer.getAttribute("expanded") == "0":
            layerEntry["expanded"] = False
        else:
            layerEntry["expanded"] = False if collapseBelowLevel >= 0 and level >= collapseBelowLevel else True
        for sublayer in layers:
            getLayerTree(sublayer, layerEntry["sublayers"], visibleLayers, printLayers, level + 1, collapseBelowLevel, titleNameMap, featureReports, externalLayers)

        if not layerEntry["sublayers"]:
            # skip empty groups
            return

    resultLayers.append(layerEntry)
    titleNameMap[treeName] = name

# parse GetCapabilities for theme
def getTheme(config, configItem, result, resultItem):
    global autogenExternalLayers

    url = update_params(urljoin(baseUrl, configItem["url"]), {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetProjectSettings'})

    try:
        opener = getUrlOpener(configItem)
        reply = opener(url).read()
        capabilities = parseString(reply)
        capabilities = capabilities.getElementsByTagName("WMS_Capabilities")[0]
        print("Parsing WMS GetProjectSettings of " + configItem["url"])

        topLayer = getChildElement(getChildElement(capabilities, "Capability"), "Layer")
        wmsName = re.sub(r".*/", "", configItem["url"]).rstrip("?")

        # use name from config or fallback to WMS title
        wmsTitle = configItem.get("title") or getChildElementValue(capabilities, "Service/Title") or getChildElementValue(topLayer, "Title") or wmsName


        # keywords
        keywords = []
        keywordList = getChildElement(capabilities, "Service/KeywordList")
        if keywordList:
            for keyword in keywordList.getElementsByTagName("Keyword"):
                value = getElementValue(keyword)
                if value != "infoMapAccessService":
                    keywords.append(value)

        # collect WMS layers for printing
        printLayers = configItem["extraPrintLayers"] if "extraPrintLayers" in configItem else []
        if "backgroundLayers" in configItem:
            printLayers = [entry["printLayer"] for entry in configItem["backgroundLayers"] if "printLayer" in entry]

        # layer tree and visible layers
        collapseLayerGroupsBelowLevel = -1
        if "collapseLayerGroupsBelowLevel" in configItem:
            collapseLayerGroupsBelowLevel = configItem["collapseLayerGroupsBelowLevel"]

        layerTree = []
        visibleLayers = []
        titleNameMap = {}
        featureReports = configItem["featureReport"] if "featureReport" in configItem else {}
        externalLayers = []
        getLayerTree(topLayer, layerTree, visibleLayers, printLayers, 1, collapseLayerGroupsBelowLevel, titleNameMap, featureReports, externalLayers)
        autogenExternalLayers += list(map(lambda entry: entry["name"], externalLayers))
        if "externalLayers" in configItem:
            externalLayers += configItem["externalLayers"]
        visibleLayers.reverse()

        # print templates
        printTemplates = []
        composerTemplates = getChildElement(capabilities, "Capability/ComposerTemplates")
        if composerTemplates:

            composerTemplateMap = {}
            for composerTemplate in composerTemplates.getElementsByTagName("ComposerTemplate"):
                composerMap = getChildElement(composerTemplate, "ComposerMap")
                if composerMap:
                    composerTemplateMap[composerTemplate.getAttribute("name")] = composerTemplate;


            for composerTemplate in composerTemplateMap.values():
                templateName = composerTemplate.getAttribute("name")
                if templateName.endswith("_legend") and templateName[:-7] in composerTemplateMap:
                    continue

                composerMap = getChildElement(composerTemplate, "ComposerMap")
                printTemplate = {
                    "name": templateName,
                    "map": {
                        "name": composerMap.getAttribute("name"),
                        "width": float(composerMap.getAttribute("width")),
                        "height": float(composerMap.getAttribute("height"))
                    }
                }
                if printTemplate["name"] + "_legend" in composerTemplateMap:
                    printTemplate["legendLayout"] = printTemplate["name"] + "_legend";

                composerLabels = composerTemplate.getElementsByTagName("ComposerLabel")
                labels = [composerLabel.getAttribute("name") for composerLabel in composerLabels]
                if "printLabelBlacklist" in configItem:
                    labels = list(filter(lambda label: label not in configItem["printLabelBlacklist"], labels))
                printTemplate['default'] = printTemplate['name'] == configItem.get('defaultPrintLayout')

                if labels:
                    printTemplate["labels"] = labels
                if composerTemplate.getAttribute('atlasEnabled') == '1':
                    atlasLayer = composerTemplate.getAttribute('atlasCoverageLayer')
                    try:
                        layers = capabilities.getElementsByTagName("Layer")
                        pk = getChildElementValue(list(filter(lambda l: getChildElementValue(l, "Name") == atlasLayer, layers))[0], "PrimaryKey/PrimaryKeyAttribute")
                        printTemplate["atlasCoverageLayer"] = atlasLayer
                        printTemplate["atlas_pk"] = pk
                    except:
                        print("Failed to determine primary key for atlas layer " + atlasLayer)

                printTemplates.append(printTemplate)

        # drawing order
        drawingOrder = getChildElementValue(capabilities, "Capability/LayerDrawingOrder").split(",")
        drawingOrder = list(map(lambda title: titleNameMap[title] if title in titleNameMap else title, drawingOrder))

        # getmap formats
        availableFormats = []
        for format in getChildElement(capabilities, "Capability/Request/GetMap").getElementsByTagName("Format"):
          availableFormats.append(getElementValue(format))

        # update theme config
        resultItem["url"] = configItem["url"]
        resultItem["id"] = uniqueThemeId(wmsName)
        resultItem["name"] = getChildElementValue(topLayer, "Name")
        resultItem["title"] = wmsTitle
        resultItem["description"] = configItem["description"] if "description" in configItem else ""
        resultItem["attribution"] = {
            "Title": configItem["attribution"] if "attribution" in configItem else "",
            "OnlineResource": configItem["attributionUrl"] if "attributionUrl" in configItem else ""
        }
        # service info
        resultItem["abstract"] = getChildElementValue(capabilities, "Service/Abstract")
        resultItem["keywords"] = ", ".join(keywords)
        resultItem["onlineResource"] = getChildElement(capabilities, "Service/OnlineResource").getAttribute("xlink:href")
        resultItem["contact"] = {
            "person": getChildElementValue(capabilities, "Service/ContactInformation/ContactPersonPrimary/ContactPerson"),
            "organization": getChildElementValue(capabilities, "Service/ContactInformation/ContactPersonPrimary/ContactOrganization"),
            "position": getChildElementValue(capabilities, "Service/ContactInformation/ContactPosition"),
            "phone": getChildElementValue(capabilities, "Service/ContactInformation/ContactVoiceTelephone"),
            "email": getChildElementValue(capabilities, "Service/ContactInformation/ContactElectronicMailAddress")
        }

        if "format" in configItem:
            resultItem["format"] = configItem["format"]
        resultItem["availableFormats"] = availableFormats
        if "tiled" in configItem:
            resultItem["tiled"] = configItem["tiled"]
        if "tileSize" in configItem:
            resultItem["tileSize"] = configItem["tileSize"]
        if "version" in configItem:
            resultItem["version"] = configItem["version"]
        elif "defaultWMSVersion" in config:
            resultItem["version"] = config["defaultWMSVersion"]
        resultItem["infoFormats"] = [getElementValue(format) for format in getChildElement(capabilities, "Capability/Request/GetFeatureInfo").getElementsByTagName("Format")]
        # use geographic bounding box for theme, as default CRS may have inverted axis order with WMS 1.3.0
        bounds = [
            float(getChildElementValue(topLayer, "EX_GeographicBoundingBox/westBoundLongitude")),
            float(getChildElementValue(topLayer, "EX_GeographicBoundingBox/southBoundLatitude")),
            float(getChildElementValue(topLayer, "EX_GeographicBoundingBox/eastBoundLongitude")),
            float(getChildElementValue(topLayer, "EX_GeographicBoundingBox/northBoundLatitude"))
        ]
        resultItem["bbox"] = {
            "crs": "EPSG:4326",
            "bounds": bounds
        }
        if "extent" in configItem:
            resultItem["initialBbox"] = {
                "crs": configItem["mapCrs"] if "mapCrs" in configItem else result["themes"]["defaultMapCrs"],
                "bounds": configItem["extent"]
            }
        else:
            resultItem["initialBbox"] = resultItem["bbox"]
        if "scales" in configItem:
            resultItem["scales"] = configItem["scales"]
        if "printScales" in configItem:
            resultItem["printScales"] = configItem["printScales"]
        if "printResolutions" in configItem:
            resultItem["printResolutions"] = configItem["printResolutions"]
        if "printGrid" in configItem:
            resultItem["printGrid"] = configItem["printGrid"]
        # NOTE: skip root WMS layer
        resultItem["sublayers"] = layerTree[0]["sublayers"] if len(layerTree) > 0 and "sublayers" in layerTree[0] else []
        resultItem["expanded"] = True
        if "backgroundLayers" in configItem:
            resultItem["backgroundLayers"] = configItem["backgroundLayers"]
        resultItem["externalLayers"] = externalLayers
        if "pluginData" in configItem:
            resultItem["pluginData"] = configItem["pluginData"]
        if "predefinedFilters" in configItem:
            resultItem["predefinedFilters"] = configItem["predefinedFilters"]
        if "snapping" in configItem:
            resultItem["snapping"] = configItem["snapping"]
        if "minSearchScaleDenom" in configItem:
            resultItem["minSearchScaleDenom"] = configItem["minSearchScaleDenom"]
        elif "minSearchScale" in configItem: # Legacy name
            resultItem["minSearchScaleDenom"] = configItem["minSearchScale"]
        if "themeInfoLinks" in configItem:
            resultItem["themeInfoLinks"] = configItem["themeInfoLinks"]
        if "layerTreeHiddenSublayers" in configItem:
            resultItem["layerTreeHiddenSublayers"] = configItem["layerTreeHiddenSublayers"]
        resultItem["searchProviders"] = configItem["searchProviders"] if "searchProviders" in configItem else []
        if "additionalMouseCrs" in configItem:
            resultItem["additionalMouseCrs"] = configItem["additionalMouseCrs"]
        if "mapCrs" in configItem:
            resultItem["mapCrs"] = configItem["mapCrs"]
        else:
            resultItem["mapCrs"] = result["themes"]["defaultMapCrs"]
        if printTemplates:
            resultItem["print"] = printTemplates
        resultItem["drawingOrder"] = drawingOrder
        if "extraDxfParameters" in configItem:
            resultItem["extraDxfParameters"] = configItem["extraDxfParameters"]
        if "extraPrintParameters" in configItem:
            resultItem["extraPrintParameters"] = configItem["extraPrintParameters"]
        extraLegenParams = configItem["extraLegendParameters"] if "extraLegendParameters" in configItem else ""
        if "legendUrl" in configItem:
            resultItem["legendUrl"] = configItem["legendUrl"]
        else:
            resultItem["legendUrl"] = getChildElement(capabilities, "Capability/Request/GetLegendGraphic/DCPType/HTTP/Get/OnlineResource").getAttribute("xlink:href").rstrip("?") + "?" + extraLegenParams
        if "featureInfoUrl" in configItem:
            resultItem["featureInfoUrl"] = configItem["featureInfoUrl"]
        else:
            resultItem["featureInfoUrl"] = getChildElement(capabilities, "Capability/Request/GetFeatureInfo/DCPType/HTTP/Get/OnlineResource").getAttribute("xlink:href").rstrip("?") + "?"
        if "printUrl" in configItem:
            resultItem["printUrl"] = configItem["printUrl"]
        else:
            resultItem["printUrl"] = getChildElement(capabilities, "Capability/Request/GetPrint/DCPType/HTTP/Get/OnlineResource").getAttribute("xlink:href").rstrip("?") + "?"
        if "printLabelForSearchResult" in configItem:
            resultItem["printLabelForSearchResult"] = configItem["printLabelForSearchResult"]
        if "printLabelForAttribution" in configItem:
            resultItem["printLabelForAttribution"] = configItem["printLabelForAttribution"]
        if "printLabelConfig" in configItem:
            resultItem["printLabelConfig"] = configItem["printLabelConfig"]

        if "watermark" in configItem:
            resultItem["watermark"] = configItem["watermark"]

        if "skipEmptyFeatureAttributes" in configItem:
            resultItem["skipEmptyFeatureAttributes"] = configItem["skipEmptyFeatureAttributes"]

        if "config" in configItem:
            resultItem["config"] = configItem["config"]

        if "flags" in configItem:
            resultItem["flags"] = configItem["flags"]

        if "mapTips" in configItem:
            resultItem["mapTips"] = configItem["mapTips"]

        if "userMap" in configItem:
            resultItem["userMap"] = configItem["userMap"]

        resultItem["editConfig"] = getEditConfig(configItem["editConfig"] if "editConfig" in configItem else None)

        # set default theme
        if configItem.get("default", False) or not result["themes"]["defaultTheme"]:
            result["themes"]["defaultTheme"] = resultItem["id"]

        # use first CRS for thumbnail request which is not CRS:84
        for item in topLayer.getElementsByTagName("CRS"):
            crs = getElementValue(item)
            if crs != "CRS:84":
                break
        extent = None
        for bbox in topLayer.getElementsByTagName("BoundingBox"):
            if bbox.getAttribute("CRS") == crs:
                extent = [
                    float(bbox.getAttribute("minx")),
                    float(bbox.getAttribute("miny")),
                    float(bbox.getAttribute("maxx")),
                    float(bbox.getAttribute("maxy"))
                ]
                break
        if extent:
            getThumbnail(configItem, resultItem, visibleLayers, crs, extent)

    except Exception as e:
        print("ERROR reading WMS GetProjectSettings of " + configItem["url"] + ":\n" + str(e))
        resultItem["error"] = "Could not read GetProjectSettings"
        resultItem["title"] = "Error"
        traceback.print_exc()


# recursively get themes for groups
def getGroupThemes(config, configGroup, result, resultGroup, groupCounter):
    for item in configGroup["items"]:
        itemEntry = {}
        getTheme(config, item, result, itemEntry)
        if itemEntry:
            resultGroup["items"].append(itemEntry)

    if "groups" in configGroup:
        for group in configGroup["groups"]:
            groupCounter += 1
            groupEntry = {
                "id": "g%d" % groupCounter,
                "title": group["title"],
                "items": [],
                "subdirs": []
            }
            getGroupThemes(config, group, result, groupEntry, groupCounter)
            resultGroup["subdirs"].append(groupEntry)


def reformatAttribution(entry):
    entry["attribution"] = {
        "Title": entry["attribution"] if "attribution" in entry else None,
        "OnlineResource": entry["attributionUrl"] if "attributionUrl" in entry else None
    }
    entry.pop("attributionUrl", None)
    return entry


def genThemes(themesConfig):
    # load themesConfig.json
    try:
        with open(themesConfig, encoding='utf-8') as fh:
            config = json.load(fh)
    except:
        return {"error": "Failed to read themesConfig.json"}

    result = {
        "themes": {
            "title": "root",
            "subdirs": [],
            "items": [],
            "defaultTheme": config["defaultTheme"] if "defaultTheme" in config else None,
            "defaultMapCrs": config["defaultMapCrs"] if "defaultMapCrs" in config else "EPSG:3857",
            "defaultScales": config["defaultScales"],
            "defaultPrintScales": config["defaultPrintScales"] if "defaultPrintScales" in config else None,
            "defaultPrintResolutions": config["defaultPrintResolutions"] if "defaultPrintResolutions" in config else None,
            "defaultPrintGrid": config["defaultPrintGrid"] if "defaultPrintGrid" in config else None,
            "defaultSearchProviders": config["defaultSearchProviders"] if "defaultSearchProviders" in config else None,
            "defaultBackgroundLayers": config["defaultBackgroundLayers"] if "defaultBackgroundLayers" in config else [],
            "pluginData": config["themes"]["pluginData"] if "pluginData" in config["themes"] else [],
            "themeInfoLinks": config["themes"]["themeInfoLinks"] if "themeInfoLinks" in config["themes"] else [],
            "externalLayers": config["themes"]["externalLayers"] if "externalLayers" in config["themes"] else [],
            "backgroundLayers": list(map(reformatAttribution, config["themes"]["backgroundLayers"])),
            "defaultWMSVersion": config["defaultWMSVersion"] if "defaultWMSVersion" in config else None
            }
    }
    groupCounter = 0
    getGroupThemes(config, config["themes"], result, result["themes"], groupCounter)

    for entry in autogenExternalLayers:
        cpos = entry.find(":")
        hpos = entry.rfind('#')
        type = entry[0:cpos]
        url = entry[cpos+1:hpos]
        layername = entry[hpos+1:]
        result["themes"]["externalLayers"].append({
            "name": entry,
            "type": type,
            "url": url,
            "params": {"LAYERS": layername},
            "infoFormats": ["text/plain"]
        })

    if "backgroundLayers" in result["themes"]:
        # get thumbnails for background layers
        for backgroundLayer in result["themes"]["backgroundLayers"]:
            imgPath = "img/mapthumbs/" + backgroundLayer.get("thumbnail", "default.jpg")
            if not os.path.isfile(qwc2_path + "/static/assets/" + imgPath):
                imgPath = "img/mapthumbs/default.jpg"
            backgroundLayer["thumbnail"] = imgPath

    return result


if __name__ == '__main__':
    print("Reading " + themesConfig)
    themes = genThemes(themesConfig)
    # write config file
    with open("./static/themes.json", "w") as fh:
        json.dump(themes, fh, indent=2, separators=(',', ': '), sort_keys=True)

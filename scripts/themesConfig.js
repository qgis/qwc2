/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*eslint no-console: 0, vars-on-top: 0, camelcase: 0*/

const urlUtil = require('url');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const isEmpty = require('lodash.isempty');
let fqdn = null;
try {
	fqdn = require('node-fqdn');
} catch(e) {
}
const uuid = require('uuid');

const hostFqdn = fqdn ? "http://" + String(fqdn()) : "";
const themesConfig = process.env["QWC2_THEMES_CONFIG"] || "themesConfig.json";

let usedThemeIds = [];
function uniqueThemeId(themeName) {
    if(!themeName) {
        return uuid.v1();
    }
    if(usedThemeIds.includes(themeName)) {
        let i = 1;
        for(; usedThemeIds.includes(themeName + i); ++i);
        usedThemeIds.push(themeName + i);
        return themeName + i;
    } else {
        usedThemeIds.push(themeName);
        return themeName;
    }
}

// load thumbnail from file or GetMap
function getThumbnail(configItem, resultItem, layers, crs, extent, resolve) {
    if (configItem.thumbnail !== undefined) {
        // check if thumbnail can be read
        if(fs.existsSync("./assets/img/mapthumbs/" + configItem.thumbnail)) {
            resultItem.thumbnail = "img/mapthumbs/" + configItem.thumbnail;
            // finish task
            resolve(true);
            return;
        }
    }

    console.error("Using WMS GetMap to generate thumbnail for " + configItem.url);

    // WMS GetMap request
    let parsedUrl = urlUtil.parse(urlUtil.resolve(hostFqdn, configItem.url), true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.3.0";
    parsedUrl.query.REQUEST = "GetMap";
    parsedUrl.query.FORMAT = "image/png";
    parsedUrl.query.TRANSPARENT = "TRUE";
    parsedUrl.query.STYLES = "";
    parsedUrl.query.WIDTH = 200;
    parsedUrl.query.HEIGHT = 100;
    parsedUrl.query.CRS = crs;
    let bboxw = extent[2] - extent[0];
    let bboxh = extent[3] - extent[1];
    let bboxcx = 0.5 * (extent[0] + extent[2]);
    let bboxcy = 0.5 * (extent[1] + extent[3]);
    let imgratio = 200./100.;
    if(bboxw > bboxh) {
        let bboxratio = bboxw/bboxh;
        if(bboxratio > imgratio) {
            bboxh = bboxw / imgratio;
        } else {
            bboxw = bboxh * imgratio;
        }
    } else {
        bboxw = bboxh * imgratio;
    }
    let adjustedExtent = [bboxcx - 0.5 * bboxw, bboxcy - 0.5 * bboxh,
                          bboxcx + 0.5 * bboxw, bboxcy + 0.5 * bboxh];
    parsedUrl.query.BBOX = adjustedExtent.join(',');
    parsedUrl.query.LAYERS = layers.join(',');
    const getMapUrl = urlUtil.format(parsedUrl);

    axios.get(getMapUrl, {
        responseType: "arraybuffer",
        auth: configItem.wmsBasicAuth,
    }).then((response) => {
        let basename = configItem.url.replace(/.*\//, "").replace(/\?.*$/, "") + ".png";
        try {
            fs.mkdirSync("./assets/img/genmapthumbs/");
        } catch(err) {
            if(err.code !== 'EEXIST') throw err;
        }
        fs.writeFileSync("./assets/img/genmapthumbs/" + basename, response.data);
        resultItem.thumbnail = "img/genmapthumbs/" + basename;
        // finish task
        resolve(true);
    }).catch((error) => {
        console.error("ERROR generating thumbnail for WMS " + configItem.url + ":\n", error);
        resultItem.thumbnail = "img/mapthumbs/default.jpg";
        // finish task
        resolve(false);
    });
}

function getEditConfig(editConfig) {
    if(isEmpty(editConfig)) {
        return null;
    } else if(path.isAbsolute(editConfig) && fs.existsSync(editConfig)) {
        return JSON.parse(fs.readFileSync(path, "utf8"));
    } else if(fs.existsSync(process.cwd() + '/' + editConfig)) {
        return JSON.parse(fs.readFileSync(process.cwd() + '/' + editConfig, "utf8"));
    }
    return null;
}
// convert non-array object to array containing the object
// used to restore arrays lost by 'explicitArray: false' xml2js option
function toArray(obj) {
    return Array.isArray(obj) ? obj : [obj];
}

// recursively get layer tree
function getLayerTree(layer, resultLayers, visibleLayers, printLayers, level, collapseBelowLevel, titleNameMap, featureReports) {
    // skip print layers
    for(let printLayer of printLayers) {
        if(Array.isArray(printLayer)) {
            if(printLayer.find(entry => entry.name === layer.Name)) {
                return;
            }
        } else if(printLayer === layer.Name) {
            return;
        }
    }

    let layerEntry = {
        name: layer.Name,
        title: layer.Title
    };
    if (layer.Layer === undefined) {
        if (!layer.$ || layer.$.geometryType == "WKBNoGeometry") {
            // skip layers without geometry
            return;
        }

        // layer
        layerEntry.visibility = layer.$.visible === '1';
        if (layerEntry.visibility) {
            // collect visible layers
            visibleLayers.push(layer.Name);
        }
        layerEntry.queryable = layer.$.queryable === '1';
        if (layerEntry.queryable) {
            layerEntry.displayField = layer.$.displayField;
        }
        if (layer.Attribution) {
            layerEntry.attribution = {
                "Title": layer.Attribution.Title,
                "OnlineResource": layer.Attribution.OnlineResource ? layer.Attribution.OnlineResource.$["xlink:href"] : ""
            };
        }
        if (layer.Abstract) {
            layerEntry.abstract = layer.Abstract;
        }
        if(layer.DataURL && layer.DataURL.OnlineResource) {
            layerEntry.dataUrl = layer.DataURL.OnlineResource.$['xlink:href'];
        }
        if(layer.MetadataURL && layer.MetadataURL.OnlineResource) {
            layerEntry.metadataUrl = layer.MetadataURL.OnlineResource.$['xlink:href'];
        }
        if(layer.$.transparency) {
            layerEntry.opacity = 255 - Math.floor(parseFloat(layer.$.transparency) / 100 * 255)
        } else {
            layerEntry.opacity = 255;
        }
        if(layer.KeywordList) {
            let keywords = [];
            toArray(layer.KeywordList.Keyword).map((entry) => {
                keywords.push((typeof entry === 'object') ? entry._ : entry);
            });
            layerEntry.keywords = keywords.join(",");
        }
        if (layer.MinScaleDenominator !== undefined) {
            layerEntry.minScale = Math.round(parseFloat(layer.MinScaleDenominator));
            layerEntry.maxScale = Math.round(parseFloat(layer.MaxScaleDenominator));
        }
        // use geographic bounding box, as default CRS may have inverted axis order with WMS 1.3.0
        if(layer.EX_GeographicBoundingBox) {
            layerEntry.bbox = {
                "crs": "EPSG:4326",
                "bounds": [
                    parseFloat(layer.EX_GeographicBoundingBox.westBoundLongitude),
                    parseFloat(layer.EX_GeographicBoundingBox.southBoundLatitude),
                    parseFloat(layer.EX_GeographicBoundingBox.eastBoundLongitude),
                    parseFloat(layer.EX_GeographicBoundingBox.northBoundLatitude)
                ]
            };
        }
        if(featureReports[layer.Name]) {
            layerEntry.featureReport = featureReports[layer.Name];
        }
    } else {
        // group
        layerEntry.mutuallyExclusive = (layer.$ || {}).mutuallyExclusive === '1';
        layerEntry.sublayers = [];
        layerEntry.expanded = collapseBelowLevel >= 0 && level >= collapseBelowLevel ? false : true;
        for (let subLayer of toArray(layer.Layer)) {
            getLayerTree(subLayer, layerEntry.sublayers, visibleLayers, printLayers, level, collapseBelowLevel, titleNameMap, featureReports);
        }
        if (layerEntry.sublayers.length === 0) {
            // skip empty groups
            return;
        }
    }
    resultLayers.push(layerEntry);
    titleNameMap[layer.TreeName] = layer.Name;
}

// parse GetCapabilities for theme
function getTheme(config, configItem, result, resultItem) {
    let parsedUrl = urlUtil.parse(urlUtil.resolve(hostFqdn, configItem.url), true);
    parsedUrl.search = '';
    parsedUrl.query.SERVICE = "WMS";
    parsedUrl.query.VERSION = "1.3.0";
    parsedUrl.query.REQUEST = "GetProjectSettings";
    const getCapabilitiesUrl = urlUtil.format(parsedUrl);

    return new Promise((resolve, reject) => {
        axios.get(getCapabilitiesUrl, { auth: configItem.wmsBasicAuth, }).then((response) => {
            // parse capabilities
            let capabilities;
            xml2js.parseString(response.data, {
                tagNameProcessors: [xml2js.processors.stripPrefix],
                explicitArray: false
            },
            (ignore, result) => {
                if (result === undefined || result.WMS_Capabilities === undefined) {
                    // show response data on parse error
                    throw new Error(response.data);
                } else {
                    capabilities = result.WMS_Capabilities;
                }
            });

            console.log("Parsing WMS GetProjectSettings of " + configItem.url);

            const topLayer = capabilities.Capability.Layer;
            const wmsName = configItem.url.replace(/.*\//,'').replace(/\?^/, '');

            // use name from config or fallback to WMS title
            const wmsTitle = configItem.title || capabilities.Service.Title || topLayer.Title || wmsName;

            // keywords
            let keywords = [];
            if(capabilities.Service.KeywordList) {
              toArray(capabilities.Service.KeywordList.Keyword).map((entry) => {
                  let value = (typeof entry === 'object') ? entry._ : entry;
                  if (value !== "infoMapAccessService") {
                      keywords.push(value);
                  }
              });
            }

            // use first CRS for thumbnail request
            const crs = toArray(topLayer.CRS).filter(item => item != 'CRS:84')[0];
            let extent = [];
            for (let bbox of toArray(topLayer.BoundingBox)) {
                if (bbox.$.CRS === crs) {
                    extent = [
                        parseFloat(bbox.$.minx),
                        parseFloat(bbox.$.miny),
                        parseFloat(bbox.$.maxx),
                        parseFloat(bbox.$.maxy)
                    ];
                    break;
                }
            }

            // collect WMS layers for printing
            let printLayers = [];
            if (configItem.backgroundLayers !== undefined) {
                printLayers = configItem.backgroundLayers.reduce((printLayers, entry) => {
                    if(entry.printLayer) {
                        printLayers.push(entry.printLayer);
                    }
                    return printLayers;
                }, []);
            }

            // layer tree and visible layers
            collapseLayerGroupsBelowLevel = configItem.collapseLayerGroupsBelowLevel || -1
            let layerTree = [];
            let visibleLayers = [];
            let titleNameMap = {};
            getLayerTree(topLayer, layerTree, visibleLayers, printLayers, 1, collapseLayerGroupsBelowLevel, titleNameMap, configItem.featureReport || {});
            visibleLayers.reverse();

            // print templates
            let printTemplates = [];
            if (capabilities.Capability.ComposerTemplates !== undefined) {
                let templates = capabilities.Capability.ComposerTemplates.ComposerTemplate;
                if(!templates.length) {
                    templates = [templates];
                }
                for (let composerTemplate of templates) {
                    let printTemplate = {
                        name: composerTemplate.$.name
                    };
                    if (composerTemplate.ComposerMap !== undefined) {
                        // use first map from GetProjectSettings
                        let composerMap = toArray(composerTemplate.ComposerMap)[0];
                        printTemplate.map = {
                            name: composerMap.$.name,
                            width: parseFloat(composerMap.$.width),
                            height: parseFloat(composerMap.$.height)
                        };
                    }
                    if (composerTemplate.ComposerLabel !== undefined) {
                        printTemplate.labels = toArray(composerTemplate.ComposerLabel).map((entry) => {
                            return entry.$.name;
                        }).filter(label => !(configItem.printLabelBlacklist || []).includes(label));
                    }
                    printTemplates.push(printTemplate);
                }
            }

            // drawing order
            let drawingOrder = (capabilities.Capability.LayerDrawingOrder || "").split(",").map(title => title in titleNameMap ? titleNameMap[title] : title);

            // update theme config
            resultItem.url = configItem.url;
            resultItem.id = uniqueThemeId(wmsName);
            resultItem.name = topLayer.Name;
            resultItem.title = wmsTitle;
            resultItem.attribution = {
                Title: configItem.attribution || "",
                OnlineResource: configItem.attributionUrl || ""
            };
            resultItem.keywords = keywords.join(', ');
            resultItem.format = configItem.format;
            resultItem.availableFormats = capabilities.Capability.Request.GetMap.Format;
            resultItem.tiled = configItem.tiled;
            resultItem.version = configItem.version ? configItem.version : config.defaultWMSVersion;
            resultItem.infoFormats = capabilities.Capability.Request.GetFeatureInfo.Format;
            // use geographic bounding box for theme, as default CRS may have inverted axis order with WMS 1.3.0
            let bounds = [
                parseFloat(topLayer.EX_GeographicBoundingBox.westBoundLongitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.southBoundLatitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.eastBoundLongitude),
                parseFloat(topLayer.EX_GeographicBoundingBox.northBoundLatitude)
            ];
            resultItem.bbox = {
                "crs": "EPSG:4326",
                "bounds": bounds
            };
            if(configItem.extent) {
                resultItem.initialBbox = {
                    "crs": configItem.mapCrs || 'EPSG:3857',
                    "bounds": configItem.extent
                };
            } else {
                resultItem.initialBbox = resultItem.bbox;
            };
            resultItem.scales = configItem.scales;
            resultItem.printScales = configItem.printScales;
            resultItem.printResolutions = configItem.printResolutions;
            resultItem.printGrid = configItem.printGrid;
            // NOTE: skip root WMS layer
            resultItem.sublayers = isEmpty(layerTree) ? [] : layerTree[0].sublayers;
            resultItem.expanded = true;
            resultItem.backgroundLayers = configItem.backgroundLayers;
            resultItem.searchProviders = configItem.searchProviders;
            resultItem.additionalMouseCrs = configItem.additionalMouseCrs;
            resultItem.mapCrs = configItem.mapCrs || 'EPSG:3857';
            if (printTemplates.length > 0) {
                resultItem.print = printTemplates;
            }
            resultItem.drawingOrder = drawingOrder;
            resultItem.legendUrl = capabilities.Capability.Request.GetLegendGraphic.DCPType.HTTP.Get.OnlineResource.$['xlink:href'] + (configItem.extraLegendParameters ? configItem.extraLegendParameters : '');
            resultItem.featureInfoUrl = capabilities.Capability.Request.GetFeatureInfo.DCPType.HTTP.Get.OnlineResource.$['xlink:href'];
            resultItem.printUrl = capabilities.Capability.Request.GetPrint.DCPType.HTTP.Get.OnlineResource.$['xlink:href'];
            if(configItem.printLabelForSearchResult) {
                resultItem.printLabelForSearchResult = configItem.printLabelForSearchResult;
            }
            if(configItem.printLabelConfig) {
                resultItem.printLabelConfig = configItem.printLabelConfig;
            }
            if(configItem.watermark) {
                resultItem.watermark = configItem.watermark;
            }

            resultItem.skipEmptyFeatureAttributes = configItem.skipEmptyFeatureAttributes;
            resultItem.allowReorderingLayers = configItem.allowReorderingLayers;
            resultItem.mapTips = configItem.mapTips;
            resultItem.userMap = configItem.userMap;
            resultItem.editConfig = getEditConfig(configItem.editConfig);

            // set default theme
            if (configItem.default || !result.themes.defaultTheme) {
                result.themes.defaultTheme = resultItem.id;
            }

            // get thumbnail asynchronously
            getThumbnail(configItem, resultItem, visibleLayers, crs, extent, resolve);
        }).catch((error) => {
            console.error("ERROR reading WMS GetProjectSettings of " + configItem.url + ":\n", error);
            resultItem.error = "Could not read GetProjectSettings";
            resultItem.title = "Error";
            // finish task
            reject(resultItem.error);
        });
    });
}

// asynchronous tasks
let tasks = [];

// recursively get themes for groups
function getGroupThemes(config, configGroup, result, resultGroup) {
    for (let item of configGroup.items) {
        let itemEntry = {};
        tasks.push(getTheme(config, item, result, itemEntry));
        resultGroup.items.push(itemEntry);
    }

    if (configGroup.groups !== undefined) {
        for (let group of configGroup.groups) {
            let groupEntry = {
                title: group.title,
                items: [],
                subdirs: []
            };
            getGroupThemes(config, group, result, groupEntry);
            resultGroup.subdirs.push(groupEntry);
        }
    }
}

function genThemes(themesConfig) {
    // load themesConfig.json
    let config = require(process.cwd() + '/' + themesConfig);

    let result = {
        themes: {
            title: "root",
            subdirs: [],
            items: [],
            defaultTheme: undefined,
            defaultScales: config.defaultScales,
            defaultPrintScales: config.defaultPrintScales,
            defaultPrintResolutions: config.defaultPrintResolutions,
            defaultPrintGrid: config.defaultPrintGrid,
            backgroundLayers: config.themes.backgroundLayers.map(bglayer => {
                    bglayer.attribution = {
                        Title: bglayer.attribution,
                        OnlineResource: bglayer.attributionUrl
                    };
                    delete bglayer.attributionUrl;
                    return bglayer;
                }),
            defaultWMSVersion: config.defaultWMSVersion
        }
    };
    getGroupThemes(config, config.themes, result, result.themes);

    if (result.themes.backgroundLayers !== undefined) {
        // get thumbnails for background layers
        result.themes.backgroundLayers.map((backgroundLayer) => {
            let imgPath = "img/mapthumbs/" + backgroundLayer.thumbnail;
            if (!fs.existsSync("./assets/" + imgPath)) {
                imgPath = "img/mapthumbs/default.jpg";
            }
            backgroundLayer.thumbnail = imgPath;
        });
    }

    return result;
}

console.log("Reading " + themesConfig);

themes = genThemes(themesConfig);
Promise.all(tasks).then(() => {
    // write config file
    fs.writeFile(process.cwd() + '/themes.json', JSON.stringify(themes, null, 2), (error) => {
        if (error) {
            console.error("ERROR:", error);
            process.exit(1);
        } else {
            console.log("\nCreated themes.json\n\n");
        }
    });
}).catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
});

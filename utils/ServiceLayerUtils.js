/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const assign = require('object-assign');
const axios = require('axios');
const deepmerge = require('deepmerge');
const isEmpty = require('lodash.isempty');
const fastXmlParser = require('fast-xml-parser');
const randomColor = require('randomcolor');
const ConfigUtils = require('./ConfigUtils');
const LayerUtils = require('./LayerUtils');
const {LayerRole} = require('../actions/layers');

const owsNS = "http://www.opengis.net/ows";
const xlinkNS="http://www.w3.org/1999/xlink";

function strcmp(a, b) {
    let al = a.toLowerCase();
    let bl = b.toLowerCase();
    return al < bl ? -1 : al > bl ? 1 : 0;
}

function array(obj) {
    return Array.isArray(obj) ? obj : [obj];
}

const ServiceLayerUtils = {
    getDCPTypes(dcpTypes) {
        let result = {};
        for(let dcpType of dcpTypes) {
            result = deepmerge(result, dcpType);
        }
        return result;
    },
    getWMTSLayers(capabilitiesXml, capabilitiesUrl, mapCrs) {
        let wmtsFormat = new ol.format.WMTSCapabilities();
        let capabilities = wmtsFormat.read(capabilitiesXml);
        let tileMatrices = capabilities.Contents.TileMatrixSet.reduce((res, entry) => {
            res[entry.Identifier] = {
                crs: entry.SupportedCRS.replace("urn:ogc:def:crs:", ""),
                matrix: entry.TileMatrix
            };
            return res;
        }, {});
        let layers = capabilities.Contents.Layer.map(layer => {
            let matchingMatrix = layer.TileMatrixSetLink.find(link => tileMatrices[link.TileMatrixSet].crs === mapCrs);
            let tileMatrixSet = matchingMatrix ? matchingMatrix.TileMatrixSet : layer.TileMatrixSetLink[0].TileMatrixSet;
            let topMatrix = tileMatrices[tileMatrixSet].matrix[0];
            let origin = topMatrix.TopLeftCorner;
            let resolutions = tileMatrices[tileMatrixSet].matrix.map(entry => {
                // 0.00028: assumed pixel width in meters, as per WMTS standard
                return entry.ScaleDenominator * 0.00028;
            });
            let url = layer.ResourceURL.find(url => url.resourceType === "tile").template;
            let dimensions = layer.Dimension.forEach(dim => {
                url = url.replace("{" + dim.Identifier + "}", dim.Default);
            });
            return {
                "type":"wmts",
                "url": url,
                "capabilitiesUrl": capabilitiesUrl,
                "title": layer.Title,
                "name": layer.Identifier,
                "tileMatrixPrefix":"",
                "tileMatrixSet": tileMatrixSet,
                "originX": origin[0],
                "originY": origin[1],
                "projection:": tileMatrices[tileMatrixSet].crs,
                "tileSize": [
                    topMatrix.TileWidth,
                    topMatrix.TileHeight
                ],
                "bbox": {
                    "crs": "EPSG:4326",
                    "bounds": layer.WGS84BoundingBox
                },
                "resolutions": resolutions,
                "abstract": layer.Abstract,
                "attribution":{
                    "Title": capabilities.ServiceProvider.ProviderName,
                    "OnlineResource": capabilities.ServiceProvider.ProviderSite
                }
            };
        });
        layers.sort((a, b) => a.title.localeCompare(b.title));
        return layers;
    },
    getWMSLayers(capabilitiesXml, asGroup=false) {
        let wmsFormat = new ol.format.WMSCapabilities();
        let capabilities = wmsFormat.read(capabilitiesXml);
        let topLayer = null;
        let serviceUrl = null;
        try {
            topLayer = capabilities.Capability.Layer;
            serviceUrl = ServiceLayerUtils.getDCPTypes(capabilities.Capability.Request.GetMap.DCPType)["HTTP"]["Get"]["OnlineResource"];
        } catch (e) {
            return [];
        }
        let featureInfoUrl = null;
        try {
            featureInfoUrl = ServiceLayerUtils.getDCPTypes(capabilities.Capability.Request.GetFeatureInfo.DCPType)["HTTP"]["Get"]["OnlineResource"];
        } catch (e) {
            featureInfoUrl = serviceUrl;
        }
        let infoFormats = null;
        try {
            infoFormats = capabilities.Capability.Request.GetFeatureInfo.Format;
        } catch(e) {
            infoFormats = ['text/plain'];
        }
        let externalLayerFeatureInfoFormats = ConfigUtils.getConfigProp("externalLayerFeatureInfoFormats") || {};
        for(let entry of Object.keys(externalLayerFeatureInfoFormats)) {
            if(featureInfoUrl.toLowerCase().includes(entry.toLowerCase())) {
                infoFormats = [externalLayerFeatureInfoFormats[entry]];
                break;
            }
        }
        let version = capabilities.version;
        if(!topLayer.Layer || asGroup) {
            return [this.getWMSLayerParams(topLayer, topLayer.CRS, serviceUrl, version, featureInfoUrl, infoFormats)].filter(entry => entry);
        } else {
            let entries = topLayer.Layer.map(layer => this.getWMSLayerParams(layer, topLayer.CRS, serviceUrl, version, featureInfoUrl, infoFormats)).filter(entry => entry);
            return entries.sort((a, b) => strcmp(a.title, b.title));
        }
    },
    getWMSLayerParams(layer, parentCrs, serviceUrl, version, featureInfoUrl, infoFormats, groupbbox = null) {
        let supportedCrs = layer.CRS;
        if(isEmpty(supportedCrs)) {
            supportedCrs = [...parentCrs];
        } else {
            supportedCrs = [...parentCrs, ...supportedCrs];
        }
        let sublayers = [];
        const sublayerbounds = {};
        if (!isEmpty(layer.Layer)) {
            sublayers = layer.Layer.map(sublayer => this.getWMSLayerParams(sublayer, supportedCrs, serviceUrl, version, featureInfoUrl, infoFormats, sublayerbounds)).filter(entry => entry);
        }
        let bbox = null;
        if (isEmpty(layer.BoundingBox)) {
            if (isEmpty(sublayerbounds)) {
                return null;
            } else {
                bbox = groupbbox;
            }
        } else {
            bbox = {
                crs: layer.BoundingBox[0].crs,
                bounds: layer.BoundingBox[0].extent
            };
            if (groupbbox !== null) {
                if (isEmpty(groupbbox)) {
                    Object.assign(groupbbox, bbox);
                } else if (bbox.crs === groupbbox.crs) {
                    groupbbox.bounds[0] = Math.min(bbox.bounds[0], groupbbox.bounds[0]);
                    groupbbox.bounds[1] = Math.min(bbox.bounds[1], groupbbox.bounds[1]);
                    groupbbox.bounds[2] = Math.max(bbox.bounds[2], groupbbox.bounds[2]);
                    groupbbox.bounds[3] = Math.max(bbox.bounds[3], groupbbox.bounds[3]);
                }
            }
        }
        let legendUrl = null;
        try {
            legendUrl = layer.Style[0].LegendURL[0].OnlineResource;
        } catch (e) {
        }
        return {
            type: "wms",
            name: layer.Name,
            title: layer.Title,
            abstract: layer.Abstract,
            attribution: layer.Attribution,
            legendUrl: legendUrl,
            url: serviceUrl,
            version: version,
            infoFormats: infoFormats,
            featureInfoUrl: featureInfoUrl,
            queryable: layer.queryable,
            sublayers: isEmpty(sublayers) ? null : sublayers,
            expanded: false,
            bbox: bbox,
            visibility: true,
            opacity: 255,
            external: true,
            minScale: layer.MinScaleDenominator,
            maxScale: layer.MaxScaleDenominator
        };
    },
    getWFSLayers(capabilitiesXml) {
        let options = {
            attrPrefix: "",
            ignoreNonTextNodeAttr: false,
            ignoreTextNodeAttr: false,
            textNodeConversion: true,
            textAttrConversion: true,
            ignoreNameSpace: true
        };
        let capabilities = fastXmlParser.convertToJson(fastXmlParser.getTraversalObj(capabilitiesXml, options));
        if(!capabilities || !capabilities.WFS_Capabilities || !capabilities.WFS_Capabilities.version) {
            return [];
        } else if(capabilities.WFS_Capabilities.version < "1.1.0") {
            return ServiceLayerUtils.getWFS10Layers(capabilities.WFS_Capabilities);
        } else {
            return ServiceLayerUtils.getWFS11_20Layers(capabilities.WFS_Capabilities);
        }
    },
    getWFS10Layers(capabilities) {
        let serviceUrl = null;
        let version = capabilities.version;
        let formats = null;
        try {
            serviceUrl = ServiceLayerUtils.getDCPTypes(array(capabilities.Capability.Request.GetFeature.DCPType))["HTTP"]["Get"]["onlineResource"];
            formats = Object.keys(capabilities.Capability.Request.GetFeature.ResultFormat);
        } catch(e) {
            return [];
        }

        let layers = [];
        for(let featureType of array(capabilities.FeatureTypeList.FeatureType)) {
            let name, bbox;
            try {
                name = featureType.Name;
                let llbbox = featureType.LatLongBoundingBox;
                bbox = {
                    crs: featureType.SRS,
                    bounds: [llbbox.minx, llbbox.miny, llbbox.maxx, llbbox.maxy]
                }
            } catch(e) {
                continue; // Name and bbox are required
            }
            let title = featureType.Title || name;
            let abstract = featureType.Abstract || "";

            layers.push({
                type: "wfs",
                name: name,
                title: title,
                abstract: abstract,
                bbox: bbox,
                url: serviceUrl,
                version: version,
                formats: formats,
                color: randomColor(),
                visibility: true
            });
        }
        return layers;
    },
    getWFS11_20Layers(capabilities) {
        let serviceUrl = null;
        let version = capabilities.version;
        let formats = null;
        try {
            let getFeatureOp = array(capabilities.OperationsMetadata.Operation).find(el => el.name === "GetFeature");
            serviceUrl = ServiceLayerUtils.getDCPTypes(array(getFeatureOp.DCP)).HTTP.Get.href;
            let outputFormat = array(getFeatureOp.Parameter).find(el => el.name === "outputFormat");
            formats = outputFormat.AllowedValues ? outputFormat.AllowedValues.Value : outputFormat.Value;
        } catch(e) {
            return [];
        }

        let layers = [];
        for(let featureType of array(capabilities.FeatureTypeList.FeatureType)) {
            let name, bbox;
            try {
                name = featureType.Name;
                let lc = featureType.WGS84BoundingBox.LowerCorner.split(/\s+/);
                let uc = featureType.WGS84BoundingBox.UpperCorner.split(/\s+/);
                bbox = {
                    crs: "EPSG:4326",
                    bounds: [lc[0], lc[1], uc[0], uc[1]]
                }
            } catch(e) {
                continue; // Name and bbox are required
            }
            let title = featureType.Title || name;
            let abstract = featureType.Abstract || "";

            layers.push({
                type: "wfs",
                name: name,
                title: title,
                abstract: abstract,
                bbox: bbox,
                url: serviceUrl,
                version: version,
                formats: formats,
                color: randomColor(),
                visibility: true
            });
        }
        return layers;
    },
    findLayers(type, serviceUrl, layerConfigs, mapCrs, callback) {
        // Scan the capabilities of the specified service for the specified layers
        let url = serviceUrl.replace(/\?$/, '');
        if(type === "wmts") {
            // Do nothing
        } else if(url.includes('?')) {
            url += "&service=" + type.toUpperCase() + "&request=GetCapabilities";
        } else {
            url += "?service=" + type.toUpperCase() + "&request=GetCapabilities";
        }
        axios.get(url).then(response => {
            for(let layerConfig of layerConfigs) {
                let result = null;
                if(type === "wms") {
                    result = ServiceLayerUtils.getWMSLayers(response.data);
                } else if(type === "wfs") {
                    result = ServiceLayerUtils.getWFSLayers(response.data);
                } else if(type === "wmts") {
                    result = ServiceLayerUtils.getWMTSLayers(response.data, url, mapCrs);
                }
                let layer = LayerUtils.searchSubLayer({sublayers: result}, "name", layerConfig.name);
                let source = type + ':' + serviceUrl + '#' + layerConfig.name;
                if(layer) {
                    layer = assign({}, layer, {
                        id: layerConfig.id,
                        opacity: layerConfig.opacity,
                        visibility: layerConfig.visibility,
                        role: LayerRole.USERLAYER,
                        sublayers: null
                    });
                    callback(layerConfig.id, layer);
                } else {
                    console.warn("Could not find layer " + layerConfig.name);
                    callback(layerConfig.id, null);
                }
            }
        }).catch(err => {
            console.warn("Failed to read " + serviceUrl);
            for(let layerConfig of layerConfigs) {
                let source = type + ':' + serviceUrl + '#' + layerConfig.name;
                callback(source, null);
            }
        });
    }
};

module.exports = ServiceLayerUtils;

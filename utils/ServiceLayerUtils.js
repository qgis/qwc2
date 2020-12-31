/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import assign from 'object-assign';
import axios from 'axios';
import deepmerge from 'deepmerge';
import isEmpty from 'lodash.isempty';
import fastXmlParser from 'fast-xml-parser';
import randomColor from 'randomcolor';
import ConfigUtils from './ConfigUtils';
import LayerUtils from './LayerUtils';
import {LayerRole} from '../actions/layers';

function strcmp(a, b) {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (al < bl) {
        return -1;
    } else if (al > bl) {
        return 1;
    }
    return 0;
}

function array(obj) {
    return Array.isArray(obj) ? obj : [obj];
}

const ServiceLayerUtils = {
    getDCPTypes(dcpTypes) {
        let result = {};
        for (const dcpType of dcpTypes) {
            result = deepmerge(result, dcpType);
        }
        return result;
    },
    getWMTSLayers(capabilitiesXml, capabilitiesUrl, mapCrs) {
        const wmtsFormat = new ol.format.WMTSCapabilities();
        const capabilities = wmtsFormat.read(capabilitiesXml);
        const tileMatrices = capabilities.Contents.TileMatrixSet.reduce((res, entry) => {
            res[entry.Identifier] = {
                crs: entry.SupportedCRS.replace("urn:ogc:def:crs:", ""),
                matrix: entry.TileMatrix
            };
            return res;
        }, {});
        const layers = capabilities.Contents.Layer.map(layer => {
            const matchingMatrix = layer.TileMatrixSetLink.find(link => tileMatrices[link.TileMatrixSet].crs === mapCrs);
            const tileMatrixSet = matchingMatrix ? matchingMatrix.TileMatrixSet : layer.TileMatrixSetLink[0].TileMatrixSet;
            const topMatrix = tileMatrices[tileMatrixSet].matrix[0];
            const origin = topMatrix.TopLeftCorner;
            const resolutions = tileMatrices[tileMatrixSet].matrix.map(entry => {
                // 0.00028: assumed pixel width in meters, as per WMTS standard
                return entry.ScaleDenominator * 0.00028;
            });
            let url = layer.ResourceURL.find(u => u.resourceType === "tile").template;
            layer.Dimension.forEach(dim => {
                url = url.replace("{" + dim.Identifier + "}", dim.Default);
            });
            return {
                "type": "wmts",
                "url": url,
                "capabilitiesUrl": capabilitiesUrl,
                "title": layer.Title,
                "name": layer.Identifier,
                "tileMatrixPrefix": "",
                "tileMatrixSet": tileMatrixSet,
                "originX": origin[0],
                "originY": origin[1],
                "projection:": tileMatrices[tileMatrixSet].crs,
                "tileSize": [
                    topMatrix.TileWidth,
                    topMatrix.TileHeight
                ],
                "bbox": {
                    crs: "EPSG:4326",
                    bounds: layer.WGS84BoundingBox
                },
                "resolutions": resolutions,
                "abstract": layer.Abstract,
                "attribution": {
                    Title: capabilities.ServiceProvider.ProviderName,
                    OnlineResource: capabilities.ServiceProvider.ProviderSite
                }
            };
        });
        layers.sort((a, b) => a.title.localeCompare(b.title));
        return layers;
    },
    getWMSLayers(capabilitiesXml, asGroup = false) {
        const wmsFormat = new ol.format.WMSCapabilities();
        const capabilities = wmsFormat.read(capabilitiesXml);
        let topLayer = null;
        let serviceUrl = null;
        try {
            topLayer = capabilities.Capability.Layer;
            serviceUrl = ServiceLayerUtils.getDCPTypes(capabilities.Capability.Request.GetMap.DCPType).HTTP.Get.OnlineResource;
        } catch (e) {
            return [];
        }
        let featureInfoUrl = null;
        try {
            featureInfoUrl = ServiceLayerUtils.getDCPTypes(capabilities.Capability.Request.GetFeatureInfo.DCPType).HTTP.Get.OnlineResource;
        } catch (e) {
            featureInfoUrl = serviceUrl;
        }
        let infoFormats = null;
        try {
            infoFormats = capabilities.Capability.Request.GetFeatureInfo.Format;
        } catch (e) {
            infoFormats = ['text/plain'];
        }
        const externalLayerFeatureInfoFormats = ConfigUtils.getConfigProp("externalLayerFeatureInfoFormats") || {};
        for (const entry of Object.keys(externalLayerFeatureInfoFormats)) {
            if (featureInfoUrl.toLowerCase().includes(entry.toLowerCase())) {
                infoFormats = [externalLayerFeatureInfoFormats[entry]];
                break;
            }
        }
        const version = capabilities.version;
        if (!topLayer.Layer || asGroup) {
            return [this.getWMSLayerParams(topLayer, topLayer.CRS, serviceUrl, version, featureInfoUrl, infoFormats)].filter(entry => entry);
        } else {
            const entries = topLayer.Layer.map(layer => this.getWMSLayerParams(layer, topLayer.CRS, serviceUrl, version, featureInfoUrl, infoFormats)).filter(entry => entry);
            return entries.sort((a, b) => strcmp(a.title, b.title));
        }
    },
    getWMSLayerParams(layer, parentCrs, serviceUrl, version, featureInfoUrl, infoFormats) {
        let supportedCrs = layer.CRS;
        if (isEmpty(supportedCrs)) {
            supportedCrs = [...parentCrs];
        } else {
            supportedCrs = [...parentCrs, ...supportedCrs];
        }
        let sublayers = [];
        if (!isEmpty(layer.Layer)) {
            sublayers = layer.Layer.map(sublayer => this.getWMSLayerParams(sublayer, supportedCrs, serviceUrl, version, featureInfoUrl, infoFormats)).filter(entry => entry);
        }
        if (isEmpty(layer.BoundingBox)) {
            return null;
        }
        const bbox = {
            crs: layer.BoundingBox[0].crs,
            bounds: layer.BoundingBox[0].extent
        };
        let legendUrl = null;
        try {
            legendUrl = layer.Style[0].LegendURL[0].OnlineResource;
        } catch (e) {
            /* Pass */
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
        const options = {
            attrPrefix: "",
            ignoreNonTextNodeAttr: false,
            ignoreTextNodeAttr: false,
            textNodeConversion: true,
            textAttrConversion: true,
            ignoreNameSpace: true
        };
        const capabilities = fastXmlParser.convertToJson(fastXmlParser.getTraversalObj(capabilitiesXml, options));
        if (!capabilities || !capabilities.WFS_Capabilities || !capabilities.WFS_Capabilities.version) {
            return [];
        } else if (capabilities.WFS_Capabilities.version < "1.1.0") {
            return ServiceLayerUtils.getWFS10Layers(capabilities.WFS_Capabilities);
        } else {
            return ServiceLayerUtils.getWFS11_20Layers(capabilities.WFS_Capabilities);
        }
    },
    getWFS10Layers(capabilities) {
        let serviceUrl = null;
        const version = capabilities.version;
        let formats = null;
        try {
            serviceUrl = ServiceLayerUtils.getDCPTypes(array(capabilities.Capability.Request.GetFeature.DCPType)).HTTP.Get.onlineResource;
            formats = Object.keys(capabilities.Capability.Request.GetFeature.ResultFormat);
        } catch (e) {
            return [];
        }

        const layers = [];
        for (const featureType of array(capabilities.FeatureTypeList.FeatureType)) {
            let name;
            let bbox;
            try {
                name = featureType.Name;
                const llbbox = featureType.LatLongBoundingBox;
                bbox = {
                    crs: featureType.SRS,
                    bounds: [llbbox.minx, llbbox.miny, llbbox.maxx, llbbox.maxy]
                };
            } catch (e) {
                continue; // Name and bbox are required
            }
            const title = featureType.Title || name;
            const abstract = featureType.Abstract || "";

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
        const version = capabilities.version;
        let formats = null;
        try {
            const getFeatureOp = array(capabilities.OperationsMetadata.Operation).find(el => el.name === "GetFeature");
            serviceUrl = ServiceLayerUtils.getDCPTypes(array(getFeatureOp.DCP)).HTTP.Get.href;
            const outputFormat = array(getFeatureOp.Parameter).find(el => el.name === "outputFormat");
            formats = outputFormat.AllowedValues ? outputFormat.AllowedValues.Value : outputFormat.Value;
        } catch (e) {
            return [];
        }

        const layers = [];
        for (const featureType of array(capabilities.FeatureTypeList.FeatureType)) {
            let name;
            let bbox;
            try {
                name = featureType.Name;
                const lc = featureType.WGS84BoundingBox.LowerCorner.split(/\s+/);
                const uc = featureType.WGS84BoundingBox.UpperCorner.split(/\s+/);
                bbox = {
                    crs: "EPSG:4326",
                    bounds: [lc[0], lc[1], uc[0], uc[1]]
                };
            } catch (e) {
                continue; // Name and bbox are required
            }
            const title = featureType.Title || name;
            const abstract = featureType.Abstract || "";

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
        if (type === "wmts") {
            // Do nothing
        } else if (url.includes('?')) {
            url += "&service=" + type.toUpperCase() + "&request=GetCapabilities";
        } else {
            url += "?service=" + type.toUpperCase() + "&request=GetCapabilities";
        }
        axios.get(url).then(response => {
            for (const layerConfig of layerConfigs) {
                let result = null;
                if (type === "wms") {
                    result = ServiceLayerUtils.getWMSLayers(response.data);
                } else if (type === "wfs") {
                    result = ServiceLayerUtils.getWFSLayers(response.data);
                } else if (type === "wmts") {
                    result = ServiceLayerUtils.getWMTSLayers(response.data, url, mapCrs);
                }
                let layer = LayerUtils.searchSubLayer({sublayers: result}, "name", layerConfig.name);
                if (layer) {
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
        }).catch(() => {
            console.warn("Failed to read " + serviceUrl);
            for (const layerConfig of layerConfigs) {
                const source = type + ':' + serviceUrl + '#' + layerConfig.name;
                callback(source, null);
            }
        });
    }
};

export default ServiceLayerUtils;

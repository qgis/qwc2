/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const proj4js = require('proj4').default;
const isEmpty = require('lodash.isempty');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const MapUtils = require('../utils/MapUtils');
const VectorLayerUtils = require('./VectorLayerUtils');

const IdentifyUtils = {
    buildRequest(layer, queryLayers, center, map, options) {
        const size = [101, 101];
        const resolution = MapUtils.computeForZoom(map.resolutions, map.zoom);
        const dx = 0.5 * resolution * size[0];
        const dy = 0.5 * resolution * size[1];
        const version = layer.version || "1.3.0";
        let bbox = [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
        if (CoordinatesUtils.getAxisOrder(map.projection).substr(0, 2) == 'ne' && version == '1.3.0')
            bbox = [center[1] - dx, center[0] - dy, center[1] + dx, center[0] + dy];
        let digits = proj4js.defs(map.projection).units === 'degrees'? 4 : 0;

        let format = 'text/plain';
        let infoFormats = layer.infoFormats || [];
        if(infoFormats.includes('text/xml')) {
            format = 'text/xml';
        } else if(infoFormats.includes('application/json')) {
            format = 'application/json';
        } else if(infoFormats.includes('text/html')) {
            format = 'text/html';
        }
        return {
            url: layer.featureInfoUrl.replace(/[?].*$/g, ''),
            params: {
                service: 'WMS',
                version: version,
                request: 'GetFeatureInfo',
                id: layer.id,
                layers: queryLayers,
                query_layers: queryLayers,
                styles: layer.style,
                x: Math.round(size[0] * 0.5),
                y: Math.round(size[1] * 0.5),
                i: Math.round(size[0] * 0.5),
                j: Math.round(size[1] * 0.5),
                height: size[0],
                width: size[1],
                srs: CoordinatesUtils.normalizeSRS(map.projection),
                crs: CoordinatesUtils.normalizeSRS(map.projection),
                bbox: bbox.join(","),
                info_format: format,
                with_geometry: true,
                with_maptip: false,
                feature_count: 10,
                map: layer.params.MAP,
                ...options
            },
            metadata: {
                layer: layer.title,
                posstr: center[0].toFixed(digits) + ", " + center[1].toFixed(digits),
                pos: center
            }
        };
    },
    buildFilterRequest(layer, queryLayers, filterGeom, map, options) {
        const size = [101, 101];
        const resolution = MapUtils.computeForZoom(map.resolutions, map.zoom);
        const version = layer.version || "1.3.0";

        let format = 'text/plain';
        if(layer.infoFormats.includes('text/xml')) {
            format = 'text/xml';
        } else if(layer.infoFormats.includes('application/json')) {
            format = 'application/json';
        } else if(layer.infoFormats.includes('text/html')) {
            format = 'text/html';
        }
        return {
            url: layer.featureInfoUrl.replace(/[?].*$/g, ''),
            params: {
                service: 'WMS',
                version: version,
                request: 'GetFeatureInfo',
                FILTER_GEOM: filterGeom,
                height: size[0],
                width: size[1],
                id: layer.id,
                layers: queryLayers,
                query_layers: queryLayers,
                styles: layer.style,
                srs: CoordinatesUtils.normalizeSRS(map.projection),
                crs: CoordinatesUtils.normalizeSRS(map.projection),
                info_format: format,
                with_geometry: true,
                with_maptip: false,
                feature_count: 100,
                map: layer.params.MAP,
                ...options
            },
            metadata: {
                layer: layer.title,
                posstr: "Region"
            }
        };
    },
    parseXmlFeature(feature, geometrycrs, id, featurereport, displayfield, layername, layerinfo) {
        let featureResult = {};
        featureResult["type"] = "Feature";
        featureResult["id"] = id;
        featureResult["featurereport"] = featurereport;
        featureResult["displayfield"] = displayfield;
        featureResult["layername"] = layername;
        featureResult["layerinfo"] = layerinfo;
        let bboxes = feature.getElementsByTagName("BoundingBox");
        if(bboxes.length > 0) {
            let bbox = bboxes[0];
            let crs = bbox.attributes.CRS ? bbox.attributes.CRS.value : bbox.attributes.SRS.value;
            featureResult["bbox"] = [
                parseFloat(bbox.attributes.minx.value),
                parseFloat(bbox.attributes.miny.value),
                parseFloat(bbox.attributes.maxx.value),
                parseFloat(bbox.attributes.maxy.value),
            ];
            featureResult["crs"] = crs;
        }
        featureResult["properties"] = {};
        attrmapping = {};
        let attributes = feature.getElementsByTagName("Attribute");
        for(let i = 0; i < attributes.length; ++i) {
            let attribute = attributes[i];
            if(attribute.attributes.name.value === "geometry") {
                let wkt = attribute.attributes.value.value;
                let feature = VectorLayerUtils.wktToGeoJSON(wkt, geometrycrs, featureResult.crs);
                if(feature) {
                    featureResult["geometry"] = feature.geometry;
                }
            } else {
                featureResult.properties[attribute.attributes.name.value] = attribute.attributes.value.value;
                if(attribute.attributes.attrname) {
                    attrmapping[attribute.attributes.name.value] = attribute.attributes.attrname.value;
                }
            }
        }
        let htmlContent = feature.getElementsByTagName("HtmlContent");
        if(htmlContent.length > 0) {
            featureResult.properties["htmlContent"] = htmlContent[0].textContent;
            featureResult.properties["htmlContentInline"] = (htmlContent[0].getAttribute("inline") === "1" || htmlContent[0].getAttribute("inline") === "true");
        }
        if(!isEmpty(attrmapping)) {
            featureResult["attribnames"] = attrmapping;
        }
        return featureResult;
    },
    parseXmlResponse(response, geometrycrs) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(response.data, "text/xml");
        let layers = [].slice.call(doc.firstChild.getElementsByTagName("Layer"));
        let result = {};
        for(let layer of layers) {
            let featurereport = layer.attributes.featurereport ? layer.attributes.featurereport.value : null;
            let displayfield = layer.attributes.displayfield ? layer.attributes.displayfield.value : null;
            let layername = layer.attributes.layername ? layer.attributes.layername.value : null;
            let layerinfo = layer.attributes.layerinfo ? layer.attributes.layerinfo.value : null;
            let features = [].slice.call(layer.getElementsByTagName("Feature"));
            if(features.length > 0) {
                result[layer.attributes.name.value] = features.map(feature => this.parseXmlFeature(feature, geometrycrs, feature.attributes.id.value, featurereport, displayfield, layername, layerinfo));
            } else {
                let attributes = [].slice.call(layer.getElementsByTagName("Attribute"));
                if(attributes.length > 0) {
                    result[layer.attributes.name.value] = [this.parseXmlFeature(layer, geometrycrs, response.request.metadata.posstr, featurereport, displayfield, layername, layerinfo)];
                }
            }
        }
        return result;
    },
    parseGeoJSONResponse(response, geometrycrs) {
        result = {};
        (response.features || []).map(feature => {
            // HACK Deduce layer name from feature id
            let layer = feature.id.substr(0, feature.id.lastIndexOf("."));
            if(result[layer] == undefined) {
                result[layer] = [];
            }

            let geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, "EPSG:4326", geometrycrs); // GeoJSON always wgs84
            result[layer].push(assign(feature, {geometry: geometry, id: feature.id.substr(feature.id.lastIndexOf(".") + 1)}));
        });
        return result;
    }
}

module.exports = IdentifyUtils;

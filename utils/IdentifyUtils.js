/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assign from 'object-assign';
import proj4js from 'proj4';
import isEmpty from 'lodash.isempty';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from './VectorLayerUtils';

const IdentifyUtils = {
    buildRequest(layer, queryLayers, center, map, options) {
        const size = [101, 101];
        const resolution = MapUtils.computeForZoom(map.resolutions, map.zoom);
        const dx = 0.5 * resolution * size[0];
        const dy = 0.5 * resolution * size[1];
        const version = layer.version || "1.3.0";
        let bbox = [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
        if (CoordinatesUtils.getAxisOrder(map.projection).substr(0, 2) === 'ne' && version === '1.3.0') {
            bbox = [center[1] - dx, center[0] - dy, center[1] + dx, center[0] + dy];
        }
        const digits = proj4js.defs(map.projection).units === 'degrees' ? 4 : 0;

        let format = 'text/plain';
        const infoFormats = layer.infoFormats || [];
        if (infoFormats.includes('text/xml') && (!layer.external || infoFormats.length === 1)) {
            format = 'text/xml';
        } else if (infoFormats.includes('application/json')) {
            format = 'application/json';
        } else if (infoFormats.includes('text/html')) {
            format = 'text/html';
        } else if (infoFormats.includes('application/vnd.ogc.gml')) {
            format = 'application/vnd.ogc.gml';
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
        const version = layer.version || "1.3.0";

        let format = 'text/plain';
        if (layer.infoFormats.includes('text/xml') && (!layer.external || layer.infoFormats.length === 1)) {
            format = 'text/xml';
        } else if (layer.infoFormats.includes('application/json')) {
            format = 'application/json';
        } else if (layer.infoFormats.includes('text/html')) {
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
        const featureResult = {};
        featureResult.type = "Feature";
        featureResult.id = id;
        featureResult.featurereport = featurereport;
        featureResult.displayfield = displayfield;
        featureResult.layername = layername;
        featureResult.layerinfo = layerinfo;
        const bboxes = feature.getElementsByTagName("BoundingBox");
        if (bboxes.length > 0) {
            const bbox = bboxes[0];
            const crs = bbox.attributes.CRS ? bbox.attributes.CRS.value : bbox.attributes.SRS.value;
            featureResult.bbox = [
                parseFloat(bbox.attributes.minx.value),
                parseFloat(bbox.attributes.miny.value),
                parseFloat(bbox.attributes.maxx.value),
                parseFloat(bbox.attributes.maxy.value)
            ];
            featureResult.crs = crs;
        }
        featureResult.properties = {};
        const attrmapping = {};
        const attributes = feature.getElementsByTagName("Attribute");
        for (let i = 0; i < attributes.length; ++i) {
            const attribute = attributes[i];
            if (attribute.attributes.name.value === "geometry") {
                const wkt = attribute.attributes.value.value;
                const geoJsonFeature = VectorLayerUtils.wktToGeoJSON(wkt, geometrycrs, featureResult.crs);
                if (geoJsonFeature) {
                    featureResult.geometry = geoJsonFeature.geometry;
                }
            } else {
                featureResult.properties[attribute.attributes.name.value] = attribute.attributes.value.value;
                if (attribute.attributes.attrname) {
                    attrmapping[attribute.attributes.name.value] = attribute.attributes.attrname.value;
                }
            }
        }
        const htmlContent = feature.getElementsByTagName("HtmlContent");
        if (htmlContent.length > 0) {
            featureResult.properties.htmlContent = htmlContent[0].textContent;
            featureResult.properties.htmlContentInline = (htmlContent[0].getAttribute("inline") === "1" || htmlContent[0].getAttribute("inline") === "true");
        }
        if (!isEmpty(attrmapping)) {
            featureResult.attribnames = attrmapping;
        }
        return featureResult;
    },
    parseXmlResponse(response, geometrycrs) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.data, "text/xml");
        const layers = [].slice.call(doc.firstChild.getElementsByTagName("Layer"));
        const result = {};
        for (const layer of layers) {
            const featurereport = layer.attributes.featurereport ? layer.attributes.featurereport.value : null;
            const displayfield = layer.attributes.displayfield ? layer.attributes.displayfield.value : null;
            const layername = layer.attributes.layername ? layer.attributes.layername.value : null;
            const layerinfo = layer.attributes.layerinfo ? layer.attributes.layerinfo.value : null;
            const features = [].slice.call(layer.getElementsByTagName("Feature"));
            if (features.length > 0) {
                result[layer.attributes.name.value] = features.map(feature => this.parseXmlFeature(feature, geometrycrs, feature.attributes.id.value, featurereport, displayfield, layername, layerinfo));
            } else {
                const attributes = [].slice.call(layer.getElementsByTagName("Attribute"));
                if (attributes.length > 0) {
                    result[layer.attributes.name.value] = [this.parseXmlFeature(layer, geometrycrs, response.request.metadata.posstr, featurereport, displayfield, layername, layerinfo)];
                }
            }
        }
        return result;
    },
    parseGeoJSONResponse(response, geometrycrs) {
        const result = {};
        (response.features || []).map(feature => {
            // HACK Deduce layer name from feature id
            const layer = feature.id.substr(0, feature.id.lastIndexOf("."));
            if (result[layer] === undefined) {
                result[layer] = [];
            }
            let geometry = feature.geometry;
            if (geometry) {
                geometry = VectorLayerUtils.reprojectGeometry(geometry, "EPSG:4326", geometrycrs); // GeoJSON always wgs84
            }
            result[layer].push(assign({}, feature, {geometry: geometry, id: feature.id.substr(feature.id.lastIndexOf(".") + 1)}));
        });
        return result;
    },
    parseGmlResponse(response) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.data, "text/xml");
        const result = {};

        const msGMLOutput = doc.getElementsByTagName("msGMLOutput")[0];
        if (msGMLOutput) {
            let count = 0;
            for (const layerEl of [].slice.call(msGMLOutput.children)) {
                const layerName = layerEl.nodeName.replace(/_layer$/, "");
                const featureName = layerName + "_feature";
                result[layerName] = [];
                for (const featureEl of [].slice.call(layerEl.getElementsByTagName(featureName))) {
                    const feature = {
                        type: "Feature",
                        id: count++,
                        layername: layerName,
                        properties: {}
                    };
                    for (const propEl of [].slice.call(featureEl.children)) {
                        if (propEl.nodeName === "gml:boundedBy") {
                            const boxEl = propEl.getElementsByTagName("gml:Box")[0];
                            if (boxEl) {
                                const coordinatesEl = boxEl.getElementsByTagName("gml:coordinates")[0];
                                if (coordinatesEl) {
                                    feature.crs = boxEl.getAttribute("srsName");
                                    feature.bbox = coordinatesEl.textContent.split(/[,\s]/).map(coo => parseFloat(coo));
                                }
                            }
                        } else {
                            feature.properties[propEl.nodeName] = propEl.textContent;
                        }
                    }
                    result[layerName].push(feature);
                }
            }
        } else {
            result[response.request.metadata.layer] = [{type: "text", text: response.data, id: response.request.metadata.posstr}];
        }
        return result;
    }
};

export default IdentifyUtils;

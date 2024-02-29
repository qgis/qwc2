/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import geojsonBbox from 'geojson-bounding-box';
import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import url from 'url';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../actions/layers';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from './VectorLayerUtils';


function identifyRequestParams(layer, queryLayers, projection, params) {
    let format = 'text/plain';
    const infoFormats = layer.infoFormats || [];
    if (infoFormats.includes('text/xml') && (layer.serverType === 'qgis' || infoFormats.length === 1)) {
        format = 'text/xml';
    } else if (infoFormats.includes('application/geojson')) {
        format = 'application/geojson';
    } else if (infoFormats.includes('application/geo+json')) {
        format = 'application/geo+json';
    } else if (infoFormats.includes('application/json')) {
        format = 'application/json';
    } else if (infoFormats.includes('text/html')) {
        format = 'text/html';
    } else if (infoFormats.includes('application/vnd.ogc.gml')) {
        format = 'application/vnd.ogc.gml';
    }
    const styles = (layer.params.STYLES || "").split(',');
    const styleMap = layer.params.LAYERS.split(',').reduce((res, lyr, idx) => ({
        ...res, [lyr]: styles[idx] ?? ''
    }));
    const queryStyles = queryLayers.split(',').map(lyr => styleMap[lyr] ?? '').join(",");
    return {
        url: layer.featureInfoUrl.split("?")[0],
        params: {
            ...url.parse(layer.featureInfoUrl,  true).query,
            service: 'WMS',
            version: layer.version,
            request: 'GetFeatureInfo',
            id: layer.id,
            layers: queryLayers,
            query_layers: queryLayers,
            styles: queryStyles,
            srs: projection,
            crs: projection,
            info_format: format,
            with_geometry: true,
            with_maptip: false,
            ...layer.dimensionValues,
            ...params
        }
    };
}

const IdentifyUtils = {
    getQueryLayers(maplayers, map) {
        const queryableLayers = maplayers.filter((l) => {
            // All non-background WMS layers with a non-empty queryLayers list
            return l.visibility && l.type === 'wms' && l.role !== LayerRole.BACKGROUND && (l.queryLayers || []).length > 0;
        });
        const mapScale = MapUtils.computeForZoom(map.scales, map.zoom);
        let result = [];
        queryableLayers.forEach((layer) => {
            const layers = [];
            const queryLayers = layer.queryLayers;
            for (let i = 0; i < queryLayers.length; ++i) {
                if (layer.externalLayerMap && layer.externalLayerMap[queryLayers[i]]) {
                    const sublayer = LayerUtils.searchSubLayer(layer, "name", queryLayers[i]);
                    const sublayerVisible = LayerUtils.layerScaleInRange(sublayer, mapScale);
                    if (!isEmpty(layer.externalLayerMap[queryLayers[i]].queryLayers) && sublayerVisible) {
                        layers.push(layer.externalLayerMap[queryLayers[i]]);
                    }
                } else if (layers.length > 0 && layers[layers.length - 1].id === layer.id) {
                    layers[layers.length - 1].queryLayers.push(queryLayers[i]);
                } else {
                    layers.push({...layer, queryLayers: [queryLayers[i]]});
                }
            }
            result = result.concat(layers);
        });
        return result;
    },
    buildRequest(layer, queryLayers, center, map, options = {}) {
        const size = [101, 101];
        const resolution = MapUtils.computeForZoom(map.resolutions, map.zoom);
        const dx = 0.5 * resolution * size[0];
        const dy = 0.5 * resolution * size[1];
        const version = layer.version;
        let bbox = [center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy];
        if (CoordinatesUtils.getAxisOrder(map.projection).substr(0, 2) === 'ne' && version === '1.3.0') {
            bbox = [center[1] - dx, center[0] - dy, center[1] + dx, center[0] + dy];
        }
        const params = {
            height: size[0],
            width: size[1],
            feature_count: 100,
            x: Math.round(size[0] * 0.5),
            y: Math.round(size[1] * 0.5),
            i: Math.round(size[0] * 0.5),
            j: Math.round(size[1] * 0.5),
            bbox: bbox.join(","),
            filter: layer.params.FILTER ?? '',
            ...options
        };
        return identifyRequestParams(layer, queryLayers, map.projection, params);
    },
    buildFilterRequest(layer, queryLayers, filterGeom, map, options = {}) {
        const size = [101, 101];
        const params = {
            height: size[0],
            width: size[1],
            feature_count: 100,
            FILTER_GEOM: filterGeom,
            ...options
        };
        return identifyRequestParams(layer, queryLayers, map.projection, params);
    },
    sendRequest(request, responseHandler) {
        const urlParts = url.parse(request.url, true);
        urlParts.query = {
            ...urlParts.query,
            ...request.params
        };
        delete urlParts.search;
        const requestUrl = url.format(urlParts);
        const maxUrlLength = ConfigUtils.getConfigProp("wmsMaxGetUrlLength", null, 2048);
        if (requestUrl.length > maxUrlLength) {
            // Switch to POST if url is too long
            const reqUrlParts = requestUrl.split("?");
            const options = {
                headers: {'content-type': 'application/x-www-form-urlencoded'}
            };
            axios.post(reqUrlParts[0], reqUrlParts[1], options).then(postResp => {
                responseHandler(postResp.data);
            }).catch(() => {
                axios.get(request.url, {params: request.params}).then(getResp => {
                    responseHandler(getResp.data);
                }).catch(() => {
                    responseHandler(null);
                });
            });
        } else {
            axios.get(request.url, {params: request.params}).then(getResp => {
                responseHandler(getResp.data);
            }).catch(() => {
                responseHandler(null);
            });
        }
    },
    parseResponse(response, layer, format, clickPoint, projection, featureInfoReturnsLayerName, layers) {
        const digits = CoordinatesUtils.getUnits(projection).units === 'degrees' ? 4 : 0;
        const posstr = clickPoint ? clickPoint[0].toFixed(digits) + ", " + clickPoint[1].toFixed(digits) : "";
        let results = {};
        if (["application/json", "application/geojson", "application/geo+json", "GeoJSON"].includes(format)) {
            results = IdentifyUtils.parseGeoJSONResponse(response, projection, layer);
        } else if (format === "text/xml") {
            results = IdentifyUtils.parseXmlResponse(response, projection, posstr, featureInfoReturnsLayerName, layers);
        } else if (format === "application/vnd.ogc.gml") {
            results = IdentifyUtils.parseGmlResponse(response, projection, posstr, layer);
        } else if (format === "text/plain") {
            results[layer.name] = [{type: "text", text: response, id: posstr, layername: layer.name, layertitle: layer.title}];
        } else if (format === "text/html") {
            results[layer.name] = [{type: "html", text: response, id: posstr, layername: layer.name, layertitle: layer.title}];
        }
        // Add clickPos, bounding box, displayname and layer name / title
        for (const layername of Object.keys(results)) {
            for (const item of results[layername]) {
                if (item.type === "Feature" && !item.bbox && item.geometry) {
                    item.crs = projection;
                    item.bbox = geojsonBbox(item);
                }
                item.clickPos = clickPoint;
                item.displayname = IdentifyUtils.determineDisplayName(layer, layername, item);
            }
        }
        return results;
    },
    determineDisplayName(layer, layername, item) {
        const properties = item.properties || {};
        if (item.displayfield) {
            if (properties[item.displayfield] && (properties[item.displayfield][0] !== "<")) {
                return properties[item.displayfield];
            }
        }
        const sublayer = LayerUtils.searchSubLayer(layer, 'name', layername);
        if (sublayer && sublayer.displayField) {
            if (properties[sublayer.displayField] && (properties[sublayer.displayField][0] !== "<")) {
                return properties[sublayer.displayField];
            }
        }
        return properties.name || properties.Name || properties.NAME || item.id;
    },
    parseXmlFeature(feature, geometrycrs, id, featurereport, displayfield, layername, layertitle, layerinfo) {
        const featureResult = {};
        featureResult.type = "Feature";
        featureResult.id = id;
        featureResult.featurereport = featurereport;
        featureResult.displayfield = displayfield;
        featureResult.layername = layername;
        featureResult.layertitle = layertitle;
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
    parseXmlResponse(response, geometrycrs, posstr = null, featureInfoReturnsLayerName = false, mapLayers = null) {
        const parser = new DOMParser();

        const doc = parser.parseFromString(response, "text/xml");
        const layers = [].slice.call(doc.firstChild.getElementsByTagName("Layer"));
        const result = {};
        let idcounter = 0;
        for (const layer of layers) {
            const featurereport = layer.attributes.featurereport ? layer.attributes.featurereport.value : null;
            const displayfield = layer.attributes.displayfield ? layer.attributes.displayfield.value : null;
            let layername = "";
            let layertitle = "";
            if (featureInfoReturnsLayerName) {
                layername = layer.attributes.name.value;
                const match = LayerUtils.searchLayer(mapLayers, 'name', layername);
                layertitle = match ? match.sublayer.title : layername;
            } else {
                layertitle = layer.attributes.name.value;
                layername = layer.attributes.layername ? layer.attributes.layername.value : layertitle;
            }

            const layerinfo = layer.attributes.layerinfo ? layer.attributes.layerinfo.value : null;
            const features = [].slice.call(layer.getElementsByTagName("Feature"));
            if (features.length > 0) {
                result[layername] = features.map(feature => this.parseXmlFeature(feature, geometrycrs, feature.attributes.id.value, featurereport, displayfield, layername, layertitle, layerinfo));
            } else {
                const attributes = [].slice.call(layer.getElementsByTagName("Attribute"));
                if (attributes.length > 0) {
                    const id = posstr || "" + (idcounter++);
                    result[layername] = [this.parseXmlFeature(layer, geometrycrs, id, featurereport, displayfield, layername, layertitle, layerinfo)];
                }
            }
        }
        return result;
    },
    parseGeoJSONResponse(response, geometrycrs, layer) {
        const result = {};
        (response.features || []).map(feature => {
            // Deduce layer name as far as possible from feature id
            const id = feature.id || (feature.properties || {}).OBJECTID || uuidv1();
            if (result[layer.name] === undefined) {
                result[layer.name] = [];
            }
            let geometry = feature.geometry;
            if (geometry) {
                geometry = VectorLayerUtils.reprojectGeometry(geometry, "EPSG:4326", geometrycrs); // GeoJSON always wgs84
            }
            result[layer.name].push({
                ...feature,
                id: id,
                geometry: geometry,
                layername: layer.name,
                layertitle: layer.title
            });
        });
        return result;
    },
    parseGmlResponse(response, geometrycrs, posstr, layer) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response, "text/xml");
        const result = {};

        const msGMLOutput = doc.getElementsByTagName("msGMLOutput")[0];
        if (msGMLOutput) {
            let count = 0;
            for (const layerEl of [].slice.call(msGMLOutput.children)) {
                const layerName = layerEl.nodeName.replace(/_layer$/, "");
                const featureName = layerName + "_feature";
                result[layerName] = [];

                for (const featureEl of [].slice.call(layerEl.getElementsByTagName(featureName))) {

                    const context = [{
                        featureType: featureName
                    }];
                    const feature = new ol.format.GeoJSON().writeFeatureObject(new ol.format.GML2().readFeatureElement(featureEl, context));
                    feature.id = count++;
                    feature.layername = layer.name;
                    feature.layertitle = layer.title;
                    delete feature.properties.boundedBy;
                    result[layerName].push(feature);
                }
            }
        } else {
            result[layer.name] = [{type: "text", text: response, id: posstr}];
        }
        return result;
    }
};

export default IdentifyUtils;

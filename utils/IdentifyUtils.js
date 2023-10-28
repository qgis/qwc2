/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import geojsonBbox from 'geojson-bounding-box';
import ol from 'openlayers';
import url from 'url';
import axios from 'axios';
import { v1 as uuidv1 } from 'uuid';
import { LayerRole } from '../actions/layers';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from './VectorLayerUtils';


function identifyRequestParams(layer, queryLayers, projection, params) {
    let format = 'text/plain';
    const infoFormats = layer.infoFormats || [];
    if (
        infoFormats.includes('text/xml') &&
        (layer.serverType === 'qgis' || infoFormats.length === 1)
    ) {
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
    return {
        url: layer.featureInfoUrl.split("?")[0],
        params: {
            ...url.parse(layer.featureInfoUrl, true).query,
            service: 'WMS',
            version: layer.version,
            request: 'GetFeatureInfo',
            id: layer.id,
            layers: queryLayers,
            query_layers: queryLayers,
            styles: layer.style,
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

/**
 * Utility functions for identifying features on the map.
 * 
 * @namespace
 */
const IdentifyUtils = {
    /**
     * Retrieve a  list of layers that should be queried.
     * 
     * @param {object[]} mapLayers - the list of layers to investigate
     * @param {object} map - the map object
     * 
     * @return {object[]} the list of layers to query
     * @todo As shown in the test, this function returns mixed results.
     */
    getQueryLayers(mapLayers, map) {
        const mapScale = MapUtils.computeForZoom(map.scales, map.zoom);
        let result = [];
        // All non-background WMS layers with a non-empty queryLayers list
        mapLayers.filter((l) => (
            l.visibility !== false &&
            l.type === 'wms' &&
            l.role !== LayerRole.BACKGROUND &&
            (l.queryLayers || []).length > 0
        )).forEach((layer) => {
            const layers = [];
            const queryLayers = layer.queryLayers;
            for (let i = 0; i < queryLayers.length; ++i) {
                if (
                    layer.externalLayerMap &&
                    layer.externalLayerMap[queryLayers[i]]
                ) {
                    const subLayer = LayerUtils.searchSubLayer(
                        layer, "name", queryLayers[i]
                    );
                    const subLayerVisible = LayerUtils.layerScaleInRange(
                        subLayer, mapScale
                    );
                    if (
                        !isEmpty(
                            layer.externalLayerMap[queryLayers[i]].queryLayers
                        ) && subLayerVisible
                    ) {
                        layers.push(layer.externalLayerMap[queryLayers[i]]);
                    }
                } else if (
                    layers.length > 0 &&
                    layers[layers.length - 1].id === layer.id
                ) {
                    layers[layers.length - 1].queryLayers.push(queryLayers[i]);
                } else {
                    layers.push({ ...layer, queryLayers: [queryLayers[i]] });
                }
            }
            result = result.concat(layers);
        });
        return result;
    },

    /**
     * Build a GetFeatureInfo request for a given layer.
     * 
     * @param {object} layer - the layer to query
     * @param {string[]} queryLayers - the list of sub-layers to query
     *  (usually the same as layer.queryLayers)
     * @param {number[]} center - the map coordinates to query
     * @param {object} map - the map object
     * @param {object} options - additional options to pass to the request
     * 
     * @return {object} the request object
     */
    buildRequest(layer, queryLayers, center, map, options = {}) {
        const size = [101, 101];
        const resolution = MapUtils.computeForZoom(map.resolutions, map.zoom);
        const dx = 0.5 * resolution * size[0];
        const dy = 0.5 * resolution * size[1];
        const version = layer.version;
        let bbox = [
            center[0] - dx, center[1] - dy,
            center[0] + dx, center[1] + dy
        ];
        if (
            CoordinatesUtils.getAxisOrder(
                map.projection
            ).substr(0, 2) === 'ne' &&
            version === '1.3.0'
        ) {
            bbox = [
                center[1] - dx, center[0] - dy,
                center[1] + dx, center[0] + dy
            ];
        }
        if (layer.params.FILTER) {
            options.filter = layer.params.FILTER;
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
            ...options
        };
        return identifyRequestParams(
            layer, queryLayers, map.projection, params
        );
    },

    /**
     * Build a GetFeatureInfo request for a given layer.
     * 
     * @param {object} layer - the layer to query
     * @param {string[]} queryLayers - the list of sub-layers to query
     * (usually the same as layer.queryLayers)
     * @param {string} filterGeom - the filter geometry to use
     * @param {object} map - the map object
     * @param {object} options - additional options to pass to the request
     * 
     * @return {object} the request object
     */
    buildFilterRequest(layer, queryLayers, filterGeom, map, options = {}) {
        const size = [101, 101];
        const params = {
            height: size[0],
            width: size[1],
            feature_count: 100,
            FILTER_GEOM: filterGeom,
            ...options
        };
        return identifyRequestParams(
            layer, queryLayers, map.projection, params
        );
    },

    /**
     * Send a request to a WMS server and return the response.
     * 
     * @param {object} request - the request object
     * @param {function} responseHandler - the callback to call with
     *  the response or null if the request failed
     */
    sendRequest(request, responseHandler) {
        const urlParts = url.parse(request.url, true);
        urlParts.query = {
            ...urlParts.query,
            ...request.params
        };
        delete urlParts.search;
        const requestUrl = url.format(urlParts);
        const maxUrlLength = ConfigUtils.getConfigProp(
            "wmsMaxGetUrlLength", null, 2048
        );
        if (requestUrl.length > maxUrlLength) {
            // Switch to POST if url is too long
            const reqUrlParts = requestUrl.split("?");
            const options = {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                }
            };
            axios.post(
                reqUrlParts[0], reqUrlParts[1], options
            ).then(postResp => {
                responseHandler(postResp.data);
            }).catch(() => {
                axios.get(
                    request.url, { params: request.params }
                ).then(getResp => {
                    responseHandler(getResp.data);
                }).catch(() => {
                    responseHandler(null);
                });
            });
        } else {
            axios.get(
                request.url, { params: request.params }
            ).then(getResp => {
                responseHandler(getResp.data);
            }).catch(() => {
                responseHandler(null);
            });
        }
    },
    parseResponse(
        response, layer, format, clickPoint,
        projection, featureInfoReturnsLayerName, layers
    ) {
        const digits = (
            CoordinatesUtils.getUnits(projection) === 'degrees'
                ? 4
                : 0
        );
        const posStr = clickPoint
            ? (
                clickPoint[0].toFixed(digits) +
                ", " +
                clickPoint[1].toFixed(digits)
            ) : "";
        let results = {};
        if ([
            "application/json",
            "application/geojson",
            "application/geo+json",
            "GeoJSON"
        ].includes(format)) {
            results = IdentifyUtils.parseGeoJSONResponse(
                response, projection, layer
            );
        } else if (format === "text/xml") {
            results = IdentifyUtils.parseXmlResponse(
                response, projection, posStr,
                featureInfoReturnsLayerName, layers
            );
        } else if (format === "application/vnd.ogc.gml") {
            results = IdentifyUtils.parseGmlResponse(
                response, projection, posStr, layer
            );
        } else if (format === "text/plain") {
            results[layer.name] = [{
                type: "text",
                text: response,
                id: posStr,
                layername: layer.name,
                layertitle: layer.title
            }];
        } else if (format === "text/html") {
            results[layer.name] = [{
                type: "html",
                text: response,
                id: posStr,
                layername: layer.name,
                layertitle: layer.title
            }];
        } else {
            // TODO LTS: Throw an exception here?
            console.warn("[parseResponse] Unsupported format: " + format);
        }
        // Add clickPos, bounding box, displayname and layer name / title
        for (const layerName of Object.keys(results)) {
            for (const item of results[layerName]) {
                if (item.type === "Feature" && !item.bbox && item.geometry) {
                    item.crs = projection;
                    item.bbox = geojsonBbox(item);
                }
                item.clickPos = clickPoint;
                item.displayname = IdentifyUtils.determineDisplayName(
                    layer, layerName, item
                );
            }
        }
        return results;
    },
    determineDisplayName(layer, layerName, item) {
        const properties = item.properties || {};
        if (item.displayfield) {
            if (
                properties[item.displayfield] &&
                (properties[item.displayfield][0] !== "<")
            ) {
                return properties[item.displayfield];
            }
        }
        const subLayer = LayerUtils.searchSubLayer(layer, 'name', layerName);
        if (subLayer && subLayer.displayField) {
            if (
                properties[subLayer.displayField] &&
                (properties[subLayer.displayField][0] !== "<")
            ) {
                return properties[subLayer.displayField];
            }
        }
        return (
            properties.name || properties.Name ||
            properties.NAME || item.id
        );
    },
    parseXmlFeature(
        feature, geometryCrs, id, featureReport, displayField,
        layerName, layerTitle, layerInfo
    ) {
        const featureResult = {};
        featureResult.type = "Feature";
        featureResult.id = id;
        featureResult.featurereport = featureReport;
        featureResult.displayfield = displayField;
        featureResult.layername = layerName;
        featureResult.layertitle = layerTitle;
        featureResult.layerinfo = layerInfo;
        const bBoxes = feature.getElementsByTagName("BoundingBox");
        if (bBoxes.length > 0) {
            const bbox = bBoxes[0];
            const crs = bbox.attributes.CRS
                ? bbox.attributes.CRS.value
                : bbox.attributes.SRS.value;
            featureResult.bbox = [
                parseFloat(bbox.attributes.minx.value),
                parseFloat(bbox.attributes.miny.value),
                parseFloat(bbox.attributes.maxx.value),
                parseFloat(bbox.attributes.maxy.value)
            ];
            featureResult.crs = crs;
        }
        featureResult.properties = {};
        const attrMapping = {};
        const attributes = feature.getElementsByTagName("Attribute");
        for (let i = 0; i < attributes.length; ++i) {
            const attribute = attributes[i];
            if (attribute.attributes.name.value === "geometry") {
                const wkt = attribute.attributes.value.value;
                const geoJsonFeature = VectorLayerUtils.wktToGeoJSON(
                    wkt, geometryCrs, featureResult.crs
                );
                if (geoJsonFeature) {
                    featureResult.geometry = geoJsonFeature.geometry;
                }
            } else {
                featureResult.properties[
                    attribute.attributes.name.value
                ] = attribute.attributes.value.value;
                if (attribute.attributes.attrname) {
                    attrMapping[
                        attribute.attributes.name.value
                    ] = attribute.attributes.attrname.value;
                }
            }
        }
        const htmlContent = feature.getElementsByTagName("HtmlContent");
        if (htmlContent.length > 0) {
            featureResult.properties.htmlContent = htmlContent[0].textContent;
            featureResult.properties.htmlContentInline = (
                htmlContent[0].getAttribute("inline") === "1" ||
                htmlContent[0].getAttribute("inline") === "true"
            );
        }
        if (!isEmpty(attrMapping)) {
            featureResult.attribnames = attrMapping;
        }
        return featureResult;
    },
    parseXmlResponse(
        response, geometryCrs, posStr = null,
        featureInfoReturnsLayerName = false, mapLayers = null
    ) {
        const parser = new DOMParser();

        const doc = parser.parseFromString(response, "text/xml");
        const layers = [].slice.call(
            doc.firstChild.getElementsByTagName("Layer")
        );
        const result = {};
        let idCounter = 0;
        for (const layer of layers) {
            const featureReport = layer.attributes.featurereport
                ? layer.attributes.featurereport.value
                : null;
            const displayField = layer.attributes.displayfield
                ? layer.attributes.displayfield.value
                : null;
            let layerName = "";
            let layerTitle = "";
            if (featureInfoReturnsLayerName) {
                layerName = layer.attributes.name.value;
                const match = LayerUtils.searchLayer(
                    mapLayers, 'name', layerName
                );
                layerTitle = match ? match.sublayer.title : layerName;
            } else {
                layerTitle = layer.attributes.name.value;
                layerName = layer.attributes.layername
                    ? layer.attributes.layername.value
                    : layerTitle;
            }

            const layerInfo = layer.attributes.layerinfo
                ? layer.attributes.layerinfo.value
                : null;
            const features = [].slice.call(
                layer.getElementsByTagName("Feature")
            );
            if (features.length > 0) {
                result[layerName] = features.map(
                    feature => this.parseXmlFeature(
                        feature, geometryCrs, feature.attributes.id.value,
                        featureReport, displayField, layerName,
                        layerTitle, layerInfo
                    )
                );
            } else {
                const attributes = [].slice.call(
                    layer.getElementsByTagName("Attribute")
                );
                if (attributes.length > 0) {
                    const id = posStr || "" + (idCounter++);
                    result[layerName] = [
                        this.parseXmlFeature(
                            layer, geometryCrs, id, featureReport,
                            displayField, layerName, layerTitle, layerInfo
                        )
                    ];
                }
            }
        }
        return result;
    },
    parseGeoJSONResponse(response, geometryCrs, layer) {
        const result = {};
        (response.features || []).map(feature => {
            // Deduce layer name as far as possible from feature id
            const id = (
                feature.id ||
                (feature.properties || {}).OBJECTID ||
                uuidv1()
            );
            if (result[layer.name] === undefined) {
                result[layer.name] = [];
            }
            let geometry = feature.geometry;
            if (geometry) {
                geometry = VectorLayerUtils.reprojectGeometry(
                    geometry, "EPSG:4326", geometryCrs
                ); // GeoJSON always wgs84
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
    parseGmlResponse(response, geometryCrs, posStr, layer) {
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

                for (
                    const featureEl of [].slice.call(
                        layerEl.getElementsByTagName(featureName)
                    )
                ) {
                    const context = [{
                        featureType: featureName
                    }];
                    const feature = new ol.format.GeoJSON().writeFeatureObject(
                        new ol.format.GML2().readFeatureElement(
                            featureEl, context
                        )
                    );
                    feature.id = count++;
                    feature.layername = layer.name;
                    feature.layertitle = layer.title;
                    delete feature.properties.boundedBy;
                    result[layerName].push(feature);
                }
            }
        } else {
            result[layer.name] = [{
                type: "text", text: response, id: posStr
            }];
        }
        return result;
    }
};

export default IdentifyUtils;

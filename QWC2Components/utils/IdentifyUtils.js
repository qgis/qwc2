/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {parse} = require('wellknown');
const assign = require('object-assign');
const proj4js = require('proj4').default;
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const MapUtils = require('../../MapStore2Components/utils/MapUtils');
const VectorLayerUtils = require('./VectorLayerUtils');

const IdentifyUtils = {
    buildRequest(layer, latlng, map, options) {
        const size = [101, 101];
        const resolution = MapUtils.getCurrentResolution(map.zoom, 0, 21, 96);
        const center = CoordinatesUtils.reproject({x: latlng.lng, y: latlng.lat}, 'EPSG:4326', map.projection);
        const dx = 0.5 * resolution * size[0];
        const dy = 0.5 * resolution * size[1];
        const bbox = [center.x - dx, center.y - dy, center.x + dx, center.y + dy];
        let digits = proj4js.defs(map.projection).units === 'degrees'? 4 : 0;

        let queryLayers = layer.queryLayers.join(",");
        let format = 'text/plain';
        if(layer.infoFormats.includes('text/xml')) {
            format = 'text/xml';
        } else if(layer.infoFormats.includes('application/json')) {
            format = 'application/json';
        }
        return {
            url: layer.url.replace(/[?].*$/g, ''),
            params: {
                service: 'WMS',
                version: layer.version,
                request: 'GetFeatureInfo',
                id: layer.id,
                layers: queryLayers,
                query_layers: queryLayers,
                styles: layer.style,
                x: Math.round(size[0] * 0.5),
                y: Math.round(size[1] * 0.5),
                height: size[0],
                width: size[1],
                srs: CoordinatesUtils.normalizeSRS(map.projection),
                crs: CoordinatesUtils.normalizeSRS(map.projection),
                bbox: bbox.join(","),
                info_format: format,
                with_geometry: true,
                with_maptip: true,
                feature_count: 10,
                ...options
            },
            metadata: {
                layer: layer.title,
                posstr: center.x.toFixed(digits) + ", " + center.y.toFixed(digits)
            }
        };
    },
    parseXmlFeature(feature, result, geometrycrs) {
        let featureResult = {};
        featureResult["type"] = "Feature";
        featureResult["id"] = feature.attributes.id.value;
        let bboxes = feature.getElementsByTagName("BoundingBox");
        if(bboxes.length > 0) {
            let bbox = bboxes[0];
            let crs = bbox.attributes.CRS ? bbox.attributes.CRS.value : bbox.attributes.SRS.value;
            featureResult["bbox"] = {
                minx: parseFloat(bbox.attributes.minx.value),
                miny: parseFloat(bbox.attributes.miny.value),
                maxx: parseFloat(bbox.attributes.maxx.value),
                maxy: parseFloat(bbox.attributes.maxy.value),
                crs: crs
            };
            featureResult["crs"] = crs;
        }
        featureResult["properties"] = {};
        let attributes = feature.getElementsByTagName("Attribute");
        for(let i = 0; i < attributes.length; ++i) {
            let attribute = attributes[i];
            if(attribute.attributes.name.value === "geometry") {
                let wkt = attribute.attributes.value.value;
                wkt = wkt.replace(/Point(\w+)/i, "Point $1")
                         .replace(/LineString(\w+)/i, "LineString $1")
                         .replace(/Polygon(\w+)/i, "Polygon $1");
                featureResult["geometry"] = parse(wkt);
                if(featureResult.bbox && featureResult.bbox.crs != geometrycrs) {
                    featureResult.geometry = VectorLayerUtils.reprojectFeatureGeometry(featureResult.geometry, featureResult.bbox.crs, geometrycrs);
                }
            } else {
                featureResult.properties[attribute.attributes.name.value] = attribute.attributes.value.value;
            }
        }
        return featureResult;
    },
    parseXmlLayer(layer, result, geometrycrs) {
        let layerResult = {};
        let features = [].slice.call(layer.getElementsByTagName("Feature"));
        result[layer.attributes.name.value] = features.map(feature => this.parseXmlFeature(feature, layerResult, geometrycrs));
    },
    parseXmlResponse(response, geometrycrs) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(response, "text/xml");
        let layers = [].slice.call(doc.firstChild.getElementsByTagName("Layer"));
        let result = {};
        layers.map(layer => this.parseXmlLayer(layer, result, geometrycrs));
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

            let geometry = VectorLayerUtils.reprojectFeatureGeometry(feature.geometry, "EPSG:4326", geometrycrs); // GeoJSON always wgs84
            result[layer].push(assign(feature, {geometry: geometry, id: feature.id.substr(feature.id.lastIndexOf(".") + 1)}));
        });
        return result;
    }
}

module.exports = IdentifyUtils;

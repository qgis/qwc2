/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const parse = require('wellknown');
const uuid = require('uuid');
const assign = require('object-assign');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');

const IdentifyUtils = {
    parseXmlFeature(feature, result, geometrycrs) {
        let featureResult = {};
        featureResult["type"] = "Feature";
        featureResult["id"] = feature.attributes.id.value;
        let bboxes = feature.getElementsByTagName("BoundingBox");
        if(bboxes.length > 0) {
            let bbox = bboxes[0];
            featureResult["bbox"] = {
                minx: parseFloat(bbox.attributes.minx.value),
                miny: parseFloat(bbox.attributes.miny.value),
                maxx: parseFloat(bbox.attributes.maxx.value),
                maxy: parseFloat(bbox.attributes.maxy.value),
                srs: bbox.attributes.SRS.value
            };
            featureResult["crs"] = bbox.attributes.SRS.value;
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
                if(featureResult.bbox && featureResult.bbox.srs != geometrycrs) {
                    featureResult.geometry = this.reprojectFeatureGeometry(featureResult.geometry, featureResult.bbox.srs, geometrycrs);
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

            let geometry = this.reprojectFeatureGeometry(feature.geometry, "EPSG:4326", geometrycrs); // GeoJSON always wgs84
            result[layer].push(assign(feature, {geometry: geometry, id: feature.id.substr(feature.id.lastIndexOf(".") + 1)}));
        });
        return result;
    },
    wktToGeoJSON(wkt) {
        wkt = wkt.replace(/Point(\w+)/i, "Point $1")
                 .replace(/LineString(\w+)/i, "LineString $1")
                 .replace(/Polygon(\w+)/i, "Polygon $1");
        return {
            "id": uuid.v1(),
            "geometry": parse(wkt),
            "type": "Feature",
            "properties": {}
        };
    },
    reprojectFeatureGeometry(geometry, srccrs, dstcrs) {
        if(geometry.type === "Point") {
            let wgscoo = CoordinatesUtils.reproject(geometry.coordinates, srccrs, dstcrs);
            return {
                "type": "Point",
                "coordinates": [wgscoo.x, wgscoo.y]
            };
        } else if(geometry.type === "LineString") {
            return {
                "type": "LineString",
                "coordinates": geometry.coordinates.map(tuple => {
                    let wgscoo = CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                    return [wgscoo.x, wgscoo.y];
                })
            };
        } else if(geometry.type === "Polygon") {
            return {
                "type": "Polygon",
                "coordinates": geometry.coordinates.map(ring => {
                    return ring.map(tuple => {
                        let wgscoo = CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                        return [wgscoo.x, wgscoo.y];
                    });
                })
            };
        } else {
            return geometry;
        }
    }
}

module.exports = IdentifyUtils;

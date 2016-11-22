/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const parse = require('wellknown');

const IdentifyUtils = {
    parseXmlFeature(feature, result) {
        let featureResult = {};
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
        }
        featureResult["attributes"] = {};
        let attributes = feature.getElementsByTagName("Attribute");
        for(let i = 0; i < attributes.length; ++i) {
            let attribute = attributes[i];
            if(attribute.attributes.name.value === "geometry") {
                featureResult["geometry"] = attribute.attributes.value.value;
            } else {
                featureResult.attributes[attribute.attributes.name.value] = attribute.attributes.value.value;
            }
        }
        return featureResult;
    },
    parseXmlLayer(layer, result) {
        let layerResult = {};
        let features = [].slice.call(layer.getElementsByTagName("Feature"));
        result[layer.attributes.name.value] = features.map(feature => this.parseXmlFeature(feature, layerResult));
    },
    parseXmlResponse(response) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(response, "text/xml");
        let layers = [].slice.call(doc.firstChild.getElementsByTagName("Layer"));
        let result = {};
        layers.map(layer => this.parseXmlLayer(layer, result));
        return result;
    },
    wktToGeoJSON(wkt) {
        wkt = wkt.replace(/Point(\w+)/i, "Point $1")
                 .replace(/LineString(\w+)/i, "LineString $1")
                 .replace(/Polygon(\w+)/i, "Polygon $1");
        return {
            "geometry": parse(wkt),
            "type": "Feature",
            "properties": null
        };
    }
}

module.exports = IdentifyUtils;

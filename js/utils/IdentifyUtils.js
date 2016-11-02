/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const IdentifyUtils = {
    parseGmlResponse: function(response, stats) {
        if (typeof response !== 'string') {
            // skip non-string response, e.g. from vector layer
            return {};
        }
        let parser = new DOMParser();
        let doc = parser.parseFromString(response, "text/xml");
        if (doc && doc.activeElement && doc.activeElement.tagName === 'parsererror') {
            return {};
        }
        let features = [].slice.call(doc.firstChild.getElementsByTagName("gml:featureMember"));
        if(features.length === 0) {
            features = [].slice.call(doc.firstChild.getElementsByTagName("featureMember"));
        }
        let layerFeatures = {};
        features.map((featureMember) => {
            let layer = featureMember.firstElementChild.nodeName;
            if(layerFeatures[layer] === undefined) {
                layerFeatures[layer] = [];
            }
            layerFeatures[layer].push(featureMember.firstElementChild);
            stats.count += 1;
            stats.lastFeature = featureMember.firstElementChild;
        });
        return layerFeatures;
    },
    gmlFeatureGeometryAsGeoJson: function(feature) {
        // The framework needs feature in GeoJSON format...
        let gmlFeature = '<wfs:FeatureCollection xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:wfs="http://www.opengis.net/wfs" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/wfs.xsd http://qgis.org/gml" xmlns:gml="http://www.opengis.net/gml" xmlns:ows="http://www.opengis.net/ows" xmlns:qgs="http://qgis.org/gml">' +
                         '<gml:featureMember>' +
                         feature.outerHTML +
                         '</gml:featureMember>' +
                         '</wfs:FeatureCollection>';
        let features = (new ol.format.GML2()).readFeatures(gmlFeature);
        return (new ol.format.GeoJSON()).writeFeaturesObject(features).features;
    }
}

module.exports = IdentifyUtils;

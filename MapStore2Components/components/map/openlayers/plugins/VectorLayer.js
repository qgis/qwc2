/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const isEqual = require('lodash.isequal');
const FeatureStyles = require('../FeatureStyles');

let VectorLayer = {
    create: (options) => {
        let styleName = options.styleName || 'default';
        return new ol.layer.Vector({
            msId: options.id,
            source: new ol.source.Vector(),
            zIndex: options.zIndex,
            style: (feature) => FeatureStyles[styleName](feature, options.styleOptions || {})
        });
    },
    update: (layer, newOptions, oldOptions) => {
        const oldCrs = oldOptions.crs || 'EPSG:3857';
        const newCrs = newOptions.crs || 'EPSG:3857';
        if (newCrs !== oldCrs) {
            layer.getSource().forEachFeature((f) => {
                f.getGeometry().transform(oldCrs, newCrs);
            });
        }
        const oldStyleName = oldOptions.styleName || 'default';
        const newStyleName = newOptions.styleName || 'default';
        if(oldStyleName != newStyleName || !isEqual(oldOptions.styleOptions, newOptions.styleOptions)) {
            layer.setStyle(feature => FeatureStyles[newStyleName](newOptions.styleOptions || {}));
        }
    },
    render: () => {
        return null;
    }
};

module.exports = VectorLayer;

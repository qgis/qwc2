/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ol = require('openlayers');

const defaultStrokeColor = [0, 0, 255, 1];
const defaultFillColor = [0, 0, 255, 0.33];
const defaultStrokeWidth = 2;
const defaultCircleRadius = 10;

const defaultStyle = new ol.style.Style({
    fill: new ol.style.Fill({
        color: defaultFillColor
    }),
    stroke: new ol.style.Stroke({
        color: defaultStrokeColor,
        width: defaultStrokeWidth,
        lineDash: [4]
    }),
    image: new ol.style.Circle({
        radius: defaultCircleRadius,
        fill: new ol.style.Fill({ color: defaultFillColor }),
        stroke: new ol.style.Stroke({color: defaultStrokeColor, width: defaultStrokeWidth})
    })
});

let VectorLayer = {
    create: (options) => {
        return new ol.layer.Vector({
            msId: options.id,
            source: new ol.source.Vector(),
            zIndex: options.zIndex,
            style: options.style || defaultStyle
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
        const oldStyle = oldOptions.style || defaultStyle;
        const newStyle = newOptions.style || defaultStyle;
        if(newStyle != oldStyle) {
            layer.setStyle(newStyle);
        }
    },
    render: () => {
        return null;
    }
};

module.exports = VectorLayer;

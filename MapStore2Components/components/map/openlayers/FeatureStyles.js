/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const markerIcon = require('./img/marker-icon.png');
const markerShadow = require('./img/marker-shadow.png');

const FeatureStyles = {
    default: (feature, options) => {
        let strokeColor = options.strokeColor || [0, 0, 255, 1];
        let strokeWidth = options.strokeWidth || 2;
        let strokeDash = options.strokeDash || [4];
        let fillColor = options.fillColor || [0, 0, 255, 0.33];
        let circleRadius = options.circleRadius || 10;
        return new ol.style.Style({
            fill: new ol.style.Fill({
                color: fillColor
            }),
            stroke: new ol.style.Stroke({
                color: strokeColor,
                width: strokeWidth,
                lineDash: strokeDash
            }),
            image: new ol.style.Circle({
                radius: circleRadius,
                fill: new ol.style.Fill({ color: fillColor }),
                stroke: new ol.style.Stroke({color: strokeColor, width: strokeWidth})
            })
        });
    },
    marker: (feature, options) => {
        return [
            new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [14, 41],
                    anchorXUnits: 'pixels',
                    anchorYUnits: 'pixels',
                    src: markerShadow
                })
            }),
            new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: 1.,
                    src: markerIcon
                }),
                text: new ol.style.Text({
                    text: feature.getProperties()["label"] || "",
                    scale: 1.25,
                    offsetY: 8,
                    fill: new ol.style.Fill({color: '#000000'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 2})
                })
            })
        ];
    }
};

module.exports = FeatureStyles;

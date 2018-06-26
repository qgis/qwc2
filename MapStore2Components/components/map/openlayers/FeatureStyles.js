/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const assign = require('object-assign');
const ConfigUtils = require('../../../utils/ConfigUtils');
const markerIcon = require('./img/marker-icon.png');
const markerShadow = require('./img/marker-shadow.png');

const FeatureStyles = {
    default: (feature, options) => {
        let opts = assign({}, ConfigUtils.getConfigProp("defaultFeatureStyle"), options);
        return new ol.style.Style({
            fill: new ol.style.Fill({
                color: opts.fillColor
            }),
            stroke: new ol.style.Stroke({
                color: opts.strokeColor,
                width: opts.strokeWidth,
                lineDash: opts.strokeDash
            }),
            image: new ol.style.Circle({
                radius: opts.circleRadius,
                fill: new ol.style.Fill({ color: opts.fillColor }),
                stroke: new ol.style.Stroke({color: opts.strokeColor, width: opts.strokeWidth})
            }),
            text: new ol.style.Text({
              font: '12pt sans',
              text: feature.getProperties()["label"] || "",
              fill: new ol.style.Fill({color: opts.textFill}),
              stroke: new ol.style.Stroke({color: opts.textStroke, width: 3}),
              textAlign: feature.getGeometry().getType() === "Point" ? 'left' : 'center',
              offsetX: feature.getGeometry().getType() === "Point" ? (5 + opts.circleRadius) : 0
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
    },
    text: (feature, options) => {
        return new ol.style.Style({
            text: new ol.style.Text({
                font: '12pt sans',
                text: feature.getProperties()["label"] || "",
                scale: options.strokeWidth,
                fill: new ol.style.Fill({color: options.fillColor}),
                stroke: new ol.style.Stroke({color: options.strokeColor, width: 2})
            })
        });
    }
};

module.exports = FeatureStyles;

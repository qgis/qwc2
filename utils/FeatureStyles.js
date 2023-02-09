/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import ConfigUtils from './ConfigUtils';
import MeasureUtils from './MeasureUtils';
import markerIcon from './img/marker-icon.png';

const DEFAULT_FEATURE_STYLE = {
    strokeColor: [0, 0, 255, 1],
    strokeWidth: 1,
    strokeDash: [4],
    fillColor: [255, 0, 255, 0.33],
    circleRadius: 10,
    textFill: "black",
    textStroke: "white",
    textFont: "11pt sans-serif"
};

export default {
    default: (feature, options) => {
        const opts = {...DEFAULT_FEATURE_STYLE, ...ConfigUtils.getConfigProp("defaultFeatureStyle"), ...options};
        const styles = [];
        styles.push(
            new ol.style.Style({
                fill: new ol.style.Fill({
                    color: opts.fillColor
                }),
                stroke: new ol.style.Stroke({
                    color: opts.strokeColor,
                    width: opts.strokeWidth,
                    lineDash: opts.strokeDash
                }),
                image: opts.circleRadius > 0 ? new ol.style.Circle({
                    radius: opts.circleRadius,
                    fill: new ol.style.Fill({ color: opts.fillColor }),
                    stroke: new ol.style.Stroke({color: opts.strokeColor, width: opts.strokeWidth})
                }) : null
            })
        );
        if (feature.getProperties().label) {
            styles.push(
                new ol.style.Style({
                    geometry: (f) => {
                        if (f.getGeometry().getType().startsWith("Multi")) {
                            // Only label middle point
                            const extent = f.getGeometry().getExtent();
                            return new ol.geom.Point(f.getGeometry().getClosestPoint(ol.extent.getCenter(extent)));
                        }
                        return f.getGeometry();
                    },
                    text: new ol.style.Text({
                        font: opts.textFont || '11pt sans-serif',
                        text: feature.getProperties().label || "",
                        overflow: true,
                        fill: new ol.style.Fill({color: opts.textFill}),
                        stroke: new ol.style.Stroke({color: opts.textStroke, width: 3}),
                        textAlign: feature.getGeometry().getType() === "Point" ? 'left' : 'center',
                        textBaseline: feature.getGeometry().getType() === "Point" ? 'bottom' : 'middle',
                        offsetX: feature.getGeometry().getType() === "Point" ? (5 + opts.circleRadius) : 0
                    })
                })
            );
        }
        if (feature.getProperties().segment_labels) {
            const segmentLabels = feature.getProperties().segment_labels;
            const coo = feature.getGeometry().getCoordinates();
            for (let i = 0; i < coo.length - 1; ++i) {
                const p1 = coo[i];
                const p2 = coo[i + 1];
                let angle = -Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
                while (angle < -0.5 * Math.PI) {
                    angle += Math.PI;
                }
                while (angle > 0.5 * Math.PI) {
                    angle -= Math.PI;
                }
                styles.push(new ol.style.Style({
                    geometry: new ol.geom.Point([0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1])]),
                    text: new ol.style.Text({
                        font: opts.textFont || '11pt sans-serif',
                        text: segmentLabels[i],
                        fill: new ol.style.Fill({color: opts.textFill}),
                        stroke: new ol.style.Stroke({color: opts.textStroke, width: 3}),
                        rotation: angle,
                        offsetY: 10
                    })
                }));
            }
        }
        return styles;
    },
    marker: (feature, options) => {
        return [
            new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: options.iconAnchor || [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: 1,
                    src: options.iconSrc || markerIcon
                }),
                text: new ol.style.Text({
                    font: '11pt sans-serif',
                    text: feature.getProperties().label || "",
                    offsetY: 8,
                    fill: new ol.style.Fill({color: '#000000'}),
                    stroke: new ol.style.Stroke({color: '#FFFFFF', width: 3})
                })
            })
        ];
    },
    text: (feature, options) => {
        return [
            new ol.style.Style({
                text: new ol.style.Text({
                    font: '10pt sans-serif',
                    text: feature.getProperties().label || "",
                    scale: options.strokeWidth,
                    fill: new ol.style.Fill({color: options.fillColor}),
                    stroke: new ol.style.Stroke({color: options.strokeColor, width: 2})
                })
            })
        ];
    }
};

/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

import ConfigUtils from './ConfigUtils';
import ResourceRegistry from './ResourceRegistry';
import arrowhead from './img/arrowhead.svg';
import markerIcon from './img/marker-icon.png';
import measurehead from './img/measurehead.svg';

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

const DEFAULT_MARKER_STYLE = {
    iconAnchor: [0.5, 1],
    opacity: 1,
    iconSrc: markerIcon,
    color: undefined,
    scale: undefined,
    crossOrigin: undefined,
    textColor: '#000000',
    textStroke: '#FFFFFF'
};

const DEFAULT_INTERACTION_STYLE = {
    fillColor: [255, 0, 0, 0.5],
    strokeColor: "red",
    strokeWidth: 1.5,
    vertexFillColor: "white",
    vertexStrokeColor: "red",
    snapFillColor: [255, 255, 255, 0.05],
    snapStrokeColor: '#3399CC',
    snapStrokeWidth: 1,
    snapVertexFillColor: [255, 255, 255, 0.05],
    snapVertexStrokeColor: '#3399CC',
    measureFillColor: [255, 0, 0, 0.25],
    measureStrokeColor: "red",
    measureStrokeWidth: 4,
    measureVertexFillColor: "white",
    measureVertexStrokeColor: "red",
    measureVertexStrokeWidth: 2,
    measurePointRadius: 6,
    sketchPointFillColor: "#0099FF",
    sketchPointStrokeColor: "white",
    sketchPointRadius: 6
};

export const END_MARKERS = {
    OUTARROW: {src: arrowhead, anchor: [0.05, 0.5], baserotation: 0},
    INARROW: {src: arrowhead, anchor: [0.05, 0.5], baserotation: 180},
    LINE: {src: measurehead, anchor: [0.05, 0.5], baserotation: 0}
};

export function computeFeatureStyle(feature) {
    return {...DEFAULT_FEATURE_STYLE, ...ConfigUtils.getConfigProp("defaultFeatureStyle"), ...feature.styleOptions};
}

const defaultStyle = (feature, options) => {
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
    if (feature.getGeometry().getType() === "LineString" && opts.headmarker in END_MARKERS) {
        const p1 = feature.getGeometry().getCoordinates()[0];
        const p2 = feature.getGeometry().getCoordinates()[1];
        const rotation = 0.5 * Math.PI + Math.atan2(p1[0] - p2[0], p1[1] - p2[1]);
        styles.push(new ol.style.Style({
            geometry: new ol.geom.Point(p1),
            image: new ol.style.Icon({
                ...END_MARKERS[opts.headmarker],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                color: opts.strokeColor,
                rotation: END_MARKERS[opts.headmarker].baserotation / 180 * Math.PI + rotation,
                scale: 0.125 * (1 + opts.strokeWidth) // Also update in VectorLayerUtils.generateMarkerGeometry
            })
        }));
    }
    if (feature.getGeometry().getType() === "LineString" && opts.tailmarker in END_MARKERS) {
        const l = feature.getGeometry().getCoordinates().length;
        const p1 = feature.getGeometry().getCoordinates()[l - 1];
        const p2 = feature.getGeometry().getCoordinates()[l - 2];
        const rotation = 0.5 * Math.PI + Math.atan2(p1[0] - p2[0], p1[1] - p2[1]);
        styles.push(new ol.style.Style({
            geometry: new ol.geom.Point(p1),
            image: new ol.style.Icon({
                ...END_MARKERS[opts.tailmarker],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                color: opts.strokeColor,
                rotation: END_MARKERS[opts.tailmarker].baserotation / 180 * Math.PI + rotation,
                scale: 0.125 * (1 + opts.strokeWidth) // Also update in VectorLayerUtils.generateMarkerGeometry
            })
        }));
    }
    return styles;
};

export default {
    default: defaultStyle,
    marker: (feature, options) => {
        const opts = {...DEFAULT_MARKER_STYLE, ...ConfigUtils.getConfigProp("defaultMarkerStyle"), ...options};
        return [
            new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: opts.iconAnchor,
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: opts.opacity,
                    crossOrigin: opts.crossOrigin,
                    src: opts.iconSrc,
                    scale: opts.scale,
                    color: opts.color
                }),
                text: new ol.style.Text({
                    font: opts.textFont || '11pt sans-serif',
                    text: feature.getProperties().label || "",
                    offsetY: 8,
                    fill: new ol.style.Fill({color: opts.textColor}),
                    stroke: new ol.style.Stroke({color: opts.textStroke, width: 3})
                })
            })
        ];
    },
    interaction: (options, isSnap) => {
        const opts = {...DEFAULT_INTERACTION_STYLE, ...ConfigUtils.getConfigProp("defaultInteractionStyle"), ...options};
        let fillColor = opts.fillColor;
        let strokeColor = opts.strokeColor;
        let strokeWidth = opts.strokeWidth;
        if (isSnap) {
            fillColor = opts.snapFillColor;
            strokeColor = opts.snapStrokeColor;
            strokeWidth = opts.snapStrokeWidth;
        }
        return new ol.style.Style({
            fill: new ol.style.Fill({ color: fillColor }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: strokeWidth})
        });
    },
    interactionVertex: (options, isSnap) => {
        const opts = {...DEFAULT_INTERACTION_STYLE, ...ConfigUtils.getConfigProp("defaultInteractionStyle"), ...options};
        let strokeWidth = opts.strokeWidth;
        let vertexFill = opts.vertexFillColor;
        let vertexStroke = opts.vertexStrokeColor;
        if (isSnap) {
            strokeWidth = opts.snapStrokeWidth;
            vertexFill = opts.snapVertexFillColor;
            vertexStroke = opts.snapVertexStrokeColor;
        }
        return new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({ color: vertexFill }),
                stroke: new ol.style.Stroke({ color: vertexStroke, width: strokeWidth }),
                points: 4,
                radius: 5,
                angle: Math.PI / 4
            }),
            geometry: opts.geometryFunction
        });
    },
    measureInteraction: (feature, options) => {
        const opts = {...DEFAULT_INTERACTION_STYLE, ...ConfigUtils.getConfigProp("defaultInteractionStyle"), ...options};
        const styleOptions = {
            strokeColor: opts.measureStrokeColor,
            strokeWidth: opts.measureStrokeWidth,
            fillColor: opts.measureFillColor,
            strokeDash: []
        };
        return defaultStyle(feature, styleOptions);
    },
    measureInteractionVertex: (options) => {
        const opts = {...DEFAULT_INTERACTION_STYLE, ...ConfigUtils.getConfigProp("defaultInteractionStyle"), ...options};
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: opts.measurePointRadius,
                fill: new ol.style.Fill({color: opts.measureVertexFillColor}),
                stroke: new ol.style.Stroke({ color: opts.measureVertexStrokeColor, width: opts.measureVertexStrokeWidth })
            }),
            geometry: opts.geometryFunction
        });
    },
    sketchInteraction: (options) => {
        const opts = {...DEFAULT_INTERACTION_STYLE, ...ConfigUtils.getConfigProp("defaultInteractionStyle"), ...options};
        return new ol.style.Style({
            image: new ol.style.Circle({
                fill: new ol.style.Fill({color: opts.sketchPointFillColor}),
                stroke: new ol.style.Stroke({color: opts.sketchPointStrokeColor, width: opts.strokeWidth}),
                radius: opts.sketchPointRadius
            })
        });
    },
    image: (feature, options) => {
        return new ol.style.Style({
            image: new ol.style.Icon({
                img: ResourceRegistry.getResource(options.img),
                rotation: options.rotation,
                anchor: [0.5, 1],
                imgSize: options.size,
                rotateWithView: true
            })
        });
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

/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const ol = require('openlayers');
const CoordinatesUtils = require('../../../utils/CoordinatesUtils');
const LocaleUtils = require('../../../utils/LocaleUtils');
const MeasureUtils = require('../../../utils/MeasureUtils');

class MeasurementSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        projection: PropTypes.string,
        measurement: PropTypes.object,
        changeMeasurementState: PropTypes.func,
    }
    constructor(props) {
        super(props);
        this.style = [
            new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(255, 0, 0, 0.25)' }),
                stroke: new ol.style.Stroke({ color: 'red', width: 4 })
            }),
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill: new ol.style.Fill({color: 'white'}),
                    stroke: new ol.style.Stroke({ color: 'red', width: 2 }),
                }),
                geometry: (feature) => {
                    if(feature.getGeometry().getType() === "Point") {
                        return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                    } else if(feature.getGeometry().getType() === "LineString") {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                    } else {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                    }
                }
            })
        ]
    }
    componentWillReceiveProps(newProps) {
        if (newProps.measurement.geomType && newProps.measurement.geomType !== this.props.measurement.geomType ) {
            this.addDrawInteraction(newProps);
        } else if (!newProps.measurement.geomType) {
            this.reset();
        } else if(newProps.measurement.lenUnit !== this.props.measurement.lenUnit) {
            this.relabelSegments(newProps);
        }
    }
    render() {
        return null;
    }
    addDrawInteraction = (newProps) => {
        this.reset();

        // Create a layer to draw on
        this.measureLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: 1000000,
            style: this.style
        });
        this.props.map.addLayer(this.measureLayer);

        let geometryType = newProps.measurement.geomType;
        if (geometryType === 'Bearing') {
            geometryType = 'LineString';
        }

        // create an interaction to draw with
        this.drawInteraction = new ol.interaction.Draw({
            source: this.measureLayer.getSource(),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            type: geometryType,
            style: []
        });

        this.drawInteraction.on('drawstart', (ev) => {
            this.segmentMarkers = [];
            this.measureLayer.getSource().clear();
            this.sketchFeature = ev.feature;
            this.sketchFeature.setStyle(this.style);
            this.props.map.on('pointermove', this.updateMeasurementResults);
            this.props.map.on('click', this.updateMeasurementResults);
        });
        this.drawInteraction.on('drawend', (ev) => {
            this.props.map.un('pointermove', this.updateMeasurementResults);
            this.props.map.un('click', this.updateMeasurementResults);
            this.updateMeasurementResults(ev, false);
            if(this.segmentMarkers.length > 0) {
                this.measureLayer.getSource().removeFeature(this.segmentMarkers.pop());
            }
        });

        this.props.map.addInteraction(this.drawInteraction);
    }
    reset = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.measureLayer);
            this.sketchFeature = null;
            this.segmentMarkers = [];
        }
    }
    updateMeasurementResults = (ev, drawing=true) => {
        if(!this.sketchFeature) {
            return;
        }
        let coo = this.sketchFeature.getGeometry().getCoordinates();

        let bearing = 0;
        if (this.props.measurement.geomType === 'Bearing' && coo.length > 1) {
            // calculate the azimuth as base for bearing information
            bearing = CoordinatesUtils.calculateAzimuth(coo[0], coo[1], this.props.projection);
            if(coo.length > 2) {
                this.drawInteraction.finishDrawing();
            }
        }
        let length = null;
        if(this.props.measurement.geomType === 'LineString') {
            length = this.calculateGeodesicDistances(coo);

            let vertexAdded = (coo.length > 0 && this.segmentMarkers.length < coo.length - 1);

            // Adjust previous marker if any
            if(vertexAdded && this.segmentMarkers.length > 0) {
                let p1 = coo[coo.length - 3];
                let p2 = coo[coo.length - 2];
                let angle = -Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
                if(Math.abs(angle) > 0.5 * Math.PI) {
                    angle += Math.PI;
                }
                let text = LocaleUtils.toLocaleFixed(MeasureUtils.getFormattedLength(this.props.measurement.lenUnit, length[coo.length - 3]), 2);
                let marker = this.segmentMarkers[this.segmentMarkers.length - 1];
                marker.getStyle().getText().setText(text);
                marker.getStyle().getText().setRotation(angle);
                marker.setGeometry(new ol.geom.Point([0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1])]));
            }

            // Add segment markers as neccessary
            if(coo.length > 0 && this.segmentMarkers.length < coo.length - 1) {
                let point = new ol.Feature({
                    geometry: new ol.geom.Point(coo[coo.length - 1])
                });
                let label = new ol.style.Text({
                    font: '10pt sans-serif',
                    text: "",
                    fill: new ol.style.Fill({color: 'white'}),
                    stroke: new ol.style.Stroke({color: [0,0,0,0.5], width: 4}),
                    rotation: 0,
                    offsetY: 10
                });
                point.setStyle(new ol.style.Style({text: label}));
                this.measureLayer.getSource().addFeature(point);
                this.segmentMarkers.push(point);
            }

            if(!vertexAdded && coo.length > 1) {
                let p1 = coo[coo.length - 2];
                let p2 = coo[coo.length - 1];
                let angle = -Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
                if(Math.abs(angle) > 0.5 * Math.PI) {
                    angle += Math.PI;
                }
                let text = LocaleUtils.toLocaleFixed(MeasureUtils.getFormattedLength(this.props.measurement.lenUnit, length[coo.length - 2]), 2);
                let marker = this.segmentMarkers[this.segmentMarkers.length - 1];
                marker.getStyle().getText().setText(text);
                marker.getStyle().getText().setRotation(angle);
                marker.setGeometry(new ol.geom.Point([0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1])]));
            }
        }
        let area = null;
        if(this.props.measurement.geomType === 'Polygon') {
            area = this.calculateGeodesicArea(this.sketchFeature.getGeometry().getLinearRing(0).getCoordinates());
        }

        this.props.changeMeasurementState({
            geomType: this.props.measurement.geomType,
            drawing: drawing,
            coordinates: coo,
            length: length,
            area: area,
            bearing: bearing,
        });
    }
    relabelSegments = (props) => {
        if(!this.sketchFeature) {
            return;
        }
        if(props.measurement.geomType === 'LineString') {
            let coo = this.sketchFeature.getGeometry().getCoordinates();
            let length = this.calculateGeodesicDistances(coo);
            for(let i = 0; i < this.segmentMarkers.length; ++i) {
                let text = LocaleUtils.toLocaleFixed(MeasureUtils.getFormattedLength(props.measurement.lenUnit, length[i]), 2);
                this.segmentMarkers[i].getStyle().getText().setText(text);
            }
            this.measureLayer.changed();
        }
    }
    reprojectedCoordinates = (coordinates) => {
        return coordinates.map((coordinate) => {
            return CoordinatesUtils.reproject(coordinate, this.props.projection, 'EPSG:4326');
        });
    }
    calculateGeodesicDistances = (coordinates) => {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        let lengths = [];
        for (let i = 0; i < reprojectedCoordinates.length - 1; ++i) {
            lengths.push(ol.sphere.getDistance(reprojectedCoordinates[i], reprojectedCoordinates[i + 1]));
        }
        return lengths;
    }
    calculateGeodesicArea = (coordinates) => {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        return Math.abs(ol.sphere.getArea(new ol.geom.Polygon([reprojectedCoordinates]), {projection: 'EPSG:4326'}));
    }
};

module.exports = MeasurementSupport;

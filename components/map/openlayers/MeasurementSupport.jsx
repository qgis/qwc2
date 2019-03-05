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
        });

        this.props.map.addInteraction(this.drawInteraction);
    }
    reset = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.measureLayer);
            this.sketchFeature = null;
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
        }
        let area = 0;
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

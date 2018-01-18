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
const wgs84Sphere = new ol.Sphere(6378137);

class MeasurementSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        projection: PropTypes.string,
        measurement: PropTypes.object,
        changeMeasurementState: PropTypes.func,
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
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.5)' }),
                stroke: new ol.style.Stroke({ color: '#ffcc33', width: 2 }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({ color: '#ffcc33' })
                })
            })
        });
        this.props.map.addLayer(this.measureLayer);

        let geometryType = newProps.measurement.geomType;
        if (geometryType === 'Bearing') {
            geometryType = 'LineString';
        }

        // create an interaction to draw with
        this.drawInteraction = new ol.interaction.Draw({
            source: this.measureLayer.getSource(),
            type: geometryType,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.5)' }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 5,
                    stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
                    fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' })
                })
            })
        });

        this.props.map.on('pointermove', this.updateMeasurementResults);
        this.props.map.on('click', this.updateMeasurementResults);

        this.drawInteraction.on('drawstart', (ev) => {
            this.measureLayer.getSource().clear();
            this.sketchFeature = ev.feature;
        });

        this.props.map.addInteraction(this.drawInteraction);
    }
    reset = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.measureLayer);
            this.sketchFeature = null;
            this.props.map.un('pointermove', this.updateMeasurementResults);
            this.props.map.un('click', this.updateMeasurementResults);
        }
    }
    updateMeasurementResults = () => {
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

        let newMeasureState = {
            coordinates: coo,
            len: this.props.measurement.geomType === 'LineString' ?
                this.calculateGeodesicDistance(coo) : 0,
            area: this.props.measurement.geomType === 'Polygon' ?
                this.calculateGeodesicArea(this.sketchFeature.getGeometry().getLinearRing(0).getCoordinates()) : 0,
            bearing: this.props.measurement.geomType === 'Bearing' ? bearing : 0,
        };

        this.props.changeMeasurementState(newMeasureState);
    }
    reprojectedCoordinates = (coordinates) => {
        return coordinates.map((coordinate) => {
            let reprojectedCoordinate = CoordinatesUtils.reproject(coordinate, this.props.projection, 'EPSG:4326');
            return [reprojectedCoordinate.x, reprojectedCoordinate.y];
        });
    }
    getPointCoordinate = (coordinate) => {
        return {x: coordinate[0], y: coordinate[1], srs: this.props.projection};
    }
    calculateGeodesicDistance = (coordinates) => {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        let length = 0;
        for (let i = 0; i < reprojectedCoordinates.length - 1; ++i) {
            length += wgs84Sphere.haversineDistance(reprojectedCoordinates[i], reprojectedCoordinates[i + 1]);
        }
        return length;
    }
    calculateGeodesicArea = (coordinates) => {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        return Math.abs(wgs84Sphere.geodesicArea(reprojectedCoordinates));
    }
};

module.exports = MeasurementSupport;

/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import {changeMeasurementState} from '../../actions/measurement';
import displayCrsSelector from '../../selectors/displaycrs';
import FeatureStyles from '../../utils/FeatureStyles';
import MeasureUtils from '../../utils/MeasureUtils';


class MeasurementSupport extends React.Component {
    static propTypes = {
        changeMeasurementState: PropTypes.func,
        displayCrs: PropTypes.string,
        map: PropTypes.object,
        mapCrs: PropTypes.string,
        measurement: PropTypes.object,
        // See defaultOpts below
        options: PropTypes.object,
        projection: PropTypes.string
    };
    static defaultOpts = {
        geodesic: true
    };
    constructor(props) {
        super(props);
        this.pickPositionCallbackTimeout = null;
        this.measureLayer = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.measurement.geomType && this.props.measurement.geomType !== prevProps.measurement.geomType ) {
            this.addDrawInteraction(this.props);
        } else if (!this.props.measurement.geomType) {
            this.reset();
        } else if (
            this.sketchFeature && (
                this.props.measurement.lenUnit !== prevProps.measurement.lenUnit ||
                this.props.measurement.areaUnit !== prevProps.measurement.areaUnit ||
                this.props.displayCrs !== prevProps.displayCrs
            )
        ) {
            this.updateMeasurementResults(this.sketchFeature, this.props.measurement.drawing);
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
            zIndex: 1000000
        });
        this.props.map.addLayer(this.measureLayer);

        let geometryType = newProps.measurement.geomType;
        if (geometryType === 'Bearing') {
            geometryType = 'LineString';
        }

        // create an interaction to draw with
        this.drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            source: this.measureLayer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            type: geometryType,
            style: () => { return this.modifyInteraction ? [] : FeatureStyles.sketchInteraction(); }
        });

        this.drawInteraction.on('drawstart', (ev) => {
            this.leaveTemporaryPickMode();
            this.measureLayer.getSource().clear();
            this.sketchFeature = ev.feature;
            this.sketchFeature.setStyle(this.featureStyleFunction);
            this.sketchFeature.on('change', evt => this.updateMeasurementResults(evt.target));
        });
        this.drawInteraction.on('drawend', () => {
            this.updateMeasurementResults(this.sketchFeature, false);
            this.enterTemporaryPickMode();
        });

        this.props.map.addInteraction(this.drawInteraction);
    };
    reset = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.leaveTemporaryPickMode();
            this.props.map.removeLayer(this.measureLayer);
            this.measureLayer = null;
            this.sketchFeature = null;
        }
    };
    enterTemporaryPickMode = () => {
        this.modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection([this.sketchFeature]),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            insertVertexCondition: () => { return this.props.measurement.geomType === 'Bearing' ? false : true; },
            deleteCondition: (event) => { return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event); },
            style: (feature) => {
                // Hack to get cursor position over geometry...
                if (this.props.measurement.pickPositionCallback) {
                    clearTimeout(this.pickPositionCallbackTimeout);
                    this.props.measurement.pickPositionCallback(feature.getGeometry().getCoordinates());
                }
                return FeatureStyles.sketchInteraction();
            }
        });
        this.props.map.on('pointermove', this.clearPickPosition);
        this.modifyInteraction.on('modifyend', () => {
            this.updateMeasurementResults(this.sketchFeature, false);
        });
        this.props.map.addInteraction(this.modifyInteraction);
    };
    leaveTemporaryPickMode = () => {
        if (this.modifyInteraction) {
            this.props.map.un('pointermove', this.clearPickPosition);
            this.props.map.removeInteraction(this.modifyInteraction);
            this.modifyInteraction = null;
        }
    };
    clearPickPosition = () => {
        if (this.props.measurement.pickPositionCallback) {
            clearTimeout(this.pickPositionCallbackTimeout);
            // Works because style function clears timeout if marker is rendered, i.e. if mouse is over measure geometry
            this.pickPositionCallbackTimeout = setTimeout(() => {
                if (this.props.measurement.pickPositionCallback) {
                    this.props.measurement.pickPositionCallback(null);
                }
            }, 50);
        }
    };
    updateMeasurementResults = (feature, drawing = true) => {
        const geomType = this.props.measurement.geomType;
        const settings = {
            lenUnit: this.props.measurement.lenUnit,
            areaUnit: this.props.measurement.areaUnit,
            decimals: this.props.measurement.decimals,
            mapCrs: this.props.mapCrs,
            displayCrs: this.props.displayCrs
        };
        MeasureUtils.updateFeatureMeasurements(feature, geomType, this.props.projection, settings);

        // Only one segment for bearing measurement
        if (geomType === 'Bearing' && feature.getGeometry().getCoordinates().length > 2) {
            this.drawInteraction.finishDrawing();
        }

        this.measureLayer.getSource().changed();
        this.props.changeMeasurementState({
            geomType: this.props.measurement.geomType,
            drawing: drawing,
            coordinates: feature.getGeometry().getCoordinates(),
            ...feature.get('measurements')
        });
    };
    featureStyleFunction = (feature) => {
        const geometryFunction = (f) => {
            if (f.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
            } else if (f.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
            }
            return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
        };
        return [
            ...FeatureStyles.measureInteraction(feature),
            FeatureStyles.measureInteractionVertex({geometryFunction})
        ];
    };
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    measurement: state.measurement,
    mapCrs: state.map.projection,
    displayCrs: displaycrs
}));

export default connect(selector, {
    changeMeasurementState
})(MeasurementSupport);

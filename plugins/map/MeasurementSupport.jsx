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
import {v4 as uuidv4} from 'uuid';

import {changeMeasurementState} from '../../actions/measurement';
import FeatureStyles from '../../utils/FeatureStyles';
import MapUtils from '../../utils/MapUtils';
import MeasureUtils from '../../utils/MeasureUtils';

/**
 * Measurement support for the map component.
 */
class MeasurementSupport extends React.Component {
    static propTypes = {
        changeMeasurementState: PropTypes.func,
        displayCrs: PropTypes.string,
        map: PropTypes.object,
        measurement: PropTypes.object,
        projection: PropTypes.string
    };
    constructor(props) {
        super(props);
        this.pickPositionCallbackTimeout = null;
        this.measureLayer = null;
        this.currentFeature = null;
        this.interactions = [];
    }
    componentDidUpdate(prevProps) {
        if (this.props.measurement.geomType && this.props.measurement.geomType !== prevProps.measurement.geomType ) {
            if (this.props.measurement.geomType === 'Reset') {
                this.reset();
                this.props.changeMeasurementState({geomType: prevProps.measurement.geomType});
            } else {
                this.addDrawInteraction(this.props);
            }
        } else if (!this.props.measurement.geomType) {
            this.reset();
        } else if (
            this.measureLayer && (
                this.props.measurement.lenUnit !== prevProps.measurement.lenUnit ||
                this.props.measurement.areaUnit !== prevProps.measurement.areaUnit ||
                this.props.displayCrs !== prevProps.displayCrs
            )
        ) {
            this.measureLayer.getSource().forEachFeature(feature =>
                this.updateMeasurementResults(feature, this.props.measurement.drawing)
            );
        }
    }
    render() {
        return null;
    }
    addDrawInteraction = (newProps) => {
        this.reset();

        this.measureLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: 1000000
        });
        this.props.map.addLayer(this.measureLayer);

        let geometryType = newProps.measurement.geomType;
        if (geometryType === 'Bearing') {
            geometryType = 'LineString';
        }

        this.drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            source: this.measureLayer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            type: geometryType,
            style: () => { return this.modifyInteraction ? [] : FeatureStyles.sketchInteraction(); }
        });
        this.selectInteraction = new ol.interaction.Select({
            layers: [this.measureLayer],
            style: null
        });
        this.modifyInteraction = new ol.interaction.Modify({
            features: this.selectInteraction.getFeatures(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            insertVertexCondition: () => { return this.props.measurement.geomType !== 'Bearing'; },
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

        this.props.map.addInteraction(this.drawInteraction);
        this.props.map.addInteraction(this.selectInteraction);
        this.props.map.addInteraction(this.modifyInteraction);

        this.selectInteraction.setActive(false);
        this.modifyInteraction.setActive(false);

        this.drawInteraction.on('drawstart', (ev) => {
            this.currentFeature = ev.feature;
            this.currentFeature.setId(uuidv4());
            this.currentFeature.setStyle(this.featureStyleFunction);
            this.currentFeature.on('change', evt => this.updateMeasurementResults(evt.target));
        });
        this.drawInteraction.on('drawend', () => {
            this.enterEditMode(this.currentFeature);
        });
        this.modifyInteraction.on('modifyend', () => {
            this.updateMeasurementResults(this.currentFeature, false);
        });
        this.props.map.on('singleclick', this.handleMapClick);
    };
    enterEditMode = (feature) => {
        this.currentFeature = feature;
        this.updateMeasurementResults(this.currentFeature, false);
        this.drawInteraction.setActive(false);
        this.selectInteraction.setActive(true);
        this.modifyInteraction.setActive(true);
        this.selectInteraction.getFeatures().clear();
        this.selectInteraction.getFeatures().push(this.currentFeature);
    };
    leaveEditMode = () => {
        this.currentFeature = null;
        this.selectInteraction.getFeatures().clear();
        this.drawInteraction.setActive(true);
        this.selectInteraction.setActive(false);
        this.modifyInteraction.setActive(false);
    };
    handleMapClick = (evt) => {
        if (!this.drawInteraction.getActive()) {
            const features = this.props.map.getFeaturesAtPixel(evt.pixel, {hitTolerance: 10, layerFilter: layer => layer === this.measureLayer});
            if (features.length === 0) {
                this.leaveEditMode();
                // Immediately start new drawing
                const clickCoord = MapUtils.getHook(MapUtils.GET_SNAPPED_COORDINATES_FROM_PIXEL_HOOK)(evt.pixel);
                this.drawInteraction.appendCoordinates([clickCoord]);
                if (this.props.measurement.geomType === 'Point') {
                    // Ughh... Apparently we need to wait 250ms for the 'singleclick' event processing to finish to avoid pick interactions picking up the current event
                    setTimeout(() => this.drawInteraction.finishDrawing(), 300);
                }
            } else {
                this.enterEditMode(features[0]);
            }
        }
    };
    reset = () => {
        if (this.drawInteraction !== null) {
            this.props.map.un('singleclick', this.handleMapClick);
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeInteraction(this.selectInteraction);
            this.selectInteraction = null;
            this.props.map.removeInteraction(this.modifyInteraction);
            this.modifyInteraction = null;
            this.props.map.removeLayer(this.measureLayer);
            this.measureLayer = null;
            this.currentFeature = null;
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
            measureId: feature.getId(),
            coordinates: feature.getGeometry().getCoordinates(),
            ...structuredClone(feature.get('measurements'))
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
        const opts = {};
        if (this.props.measurement.geomType === 'LineString') {
            opts.headmarker = this.props.measurement.lineHeadMarker;
            opts.tailmarker = this.props.measurement.lineTailMarker;
        } else if (this.props.measurement.geomType === 'Bearing') {
            opts.headmarker = this.props.measurement.bearingHeadMarker;
            opts.tailmarker = this.props.measurement.bearingTailMarker;
        }
        opts.markerscale = this.props.measurement.markerScale;
        const styles = [...FeatureStyles.measureInteraction(feature, opts)];
        if (feature === this.currentFeature) {
            styles.push(FeatureStyles.measureInteractionVertex({geometryFunction}));
        }
        return styles;
    };
}

export default connect((state) => ({
    displayCrs: state.map.displayCrs,
    measurement: state.measurement
}), {
    changeMeasurementState
})(MeasurementSupport);

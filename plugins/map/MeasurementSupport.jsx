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

import {addLayerFeatures, removeLayer} from '../../actions/layers';
import {changeMeasurementState} from '../../actions/measurement';
import FeatureStyles, {computeMeasureFeatureStyle} from '../../utils/FeatureStyles';
import MapUtils from '../../utils/MapUtils';
import MeasureUtils from '../../utils/MeasureUtils';

/**
 * Measurement support for the map component.
 */
class MeasurementSupport extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        changeMeasurementState: PropTypes.func,
        displayCrs: PropTypes.string,
        map: PropTypes.object,
        measurement: PropTypes.object,
        projection: PropTypes.string,
        removeLayer: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.pickPositionCallbackTimeout = null;
        this.measureLayer = null;
        this.currentFeature = null;
        this.interactions = [];
    }
    componentDidUpdate(prevProps) {
        if (this.props.measurement.mode === 'Reset') {
            this.removeInteractions(true);
            const nextmode = this.props.measurement.nextmode !== undefined ? this.props.measurement.nextmode : prevProps.measurement.mode;
            this.props.changeMeasurementState({mode: nextmode});
        } else if (this.props.measurement.mode && this.props.measurement.mode !== prevProps.measurement.mode) {
            this.setupInteractions();
        } else if (!this.props.measurement.mode && prevProps.measurement.mode) {
            this.removeInteractions();
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
    setupInteractions = () => {
        if (!this.measureLayer) {
            this.measureLayer = new ol.layer.Vector({
                source: new ol.source.Vector(),
                zIndex: 1000000
            });
            this.measureLayer.set('id', uuidv4());
            this.props.map.addLayer(this.measureLayer);
        }
        let geometryType = this.props.measurement.mode;
        if (geometryType === 'Bearing') {
            geometryType = 'LineString';
        }
        // If a draw interaction already exists, replace it

        const drawInteractionPos = this.drawInteraction ?
            this.props.map.getInteractions().getArray().findIndex(item => item === this.drawInteraction) : null;

        this.drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            source: this.measureLayer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            maxPoints: this.props.measurement.mode === 'Bearing' ? 2 : undefined,
            type: geometryType,
            style: []
        });
        this.drawInteraction.on('drawstart', (ev) => {
            this.currentFeature = ev.feature;
            this.currentFeature.setId(uuidv4());
            this.currentFeature.set('measureMode', this.props.measurement.mode);
            this.currentFeature.setStyle(this.featureStyleFunction);
            this.currentFeature.on('change', evt => this.updateMeasurementResults(evt.target));
        });
        this.drawInteraction.on('drawend', () => {
            this.enterEditMode(this.currentFeature);
        });
        if (drawInteractionPos !== null) {
            this.drawInteraction.setActive(!this.modifyInteraction.getActive());
            this.props.map.getInteractions().setAt(drawInteractionPos, this.drawInteraction);
        } else {
            this.drawInteraction.setActive(false);
            this.props.map.addInteraction(this.drawInteraction);

            // If draw interaction is missing, then also the select and modify interactions were missing
            this.selectInteraction = new ol.interaction.Select({
                layers: [this.measureLayer],
                style: null,
                hitTolerance: 5
            });
            this.modifyInteraction = new ol.interaction.Modify({
                features: this.selectInteraction.getFeatures(),
                condition: (event) => { return event.originalEvent.buttons === 1; },
                insertVertexCondition: () => { return this.props.measurement.mode !== 'Bearing'; },
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

            this.props.map.addInteraction(this.selectInteraction);
            this.props.map.addInteraction(this.modifyInteraction);

            this.selectInteraction.setActive(true);
            this.modifyInteraction.setActive(true);

            this.modifyInteraction.on('modifyend', () => {
                this.updateMeasurementResults(this.currentFeature, false);
            });
            this.props.map.on('singleclick', this.handleMapClick);
            this.props.map.on('pointermove', this.clearPickPosition);
        }
    };
    removeInteractions = (clearLayer) => {
        if (this.drawInteraction !== null) {
            this.currentFeature = null;
            this.measureLayer.getSource().changed();
            this.props.map.un('singleclick', this.handleMapClick);
            this.props.map.un('pointermove', this.clearPickPosition);
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeInteraction(this.selectInteraction);
            this.selectInteraction = null;
            this.props.map.removeInteraction(this.modifyInteraction);
            this.modifyInteraction = null;
        }
        if (this.measureLayer) {
            if (clearLayer) {
                this.props.removeLayer(this.measureLayer.get('id'));
                this.props.map.removeLayer(this.measureLayer);
                this.measureLayer = null;
            } else {
                // Serialize to global state
                const format = new ol.format.GeoJSON();
                const features = this.measureLayer.getSource().getFeatures().map(feature => {
                    const featureObject = format.writeFeatureObject(feature);
                    featureObject.styleName = 'default';
                    featureObject.styleOptions = computeMeasureFeatureStyle(this.endMarkerOptions(feature));
                    return featureObject;
                });
                const layer = {
                    id: this.measureLayer.get('id'),
                    type: 'vector',
                    externallyManaged: true,
                    crs: this.props.map.getView().getProjection().getCode(),
                    layertreehidden: true
                };
                this.props.addLayerFeatures(layer, features);
            }
        }
    };
    enterEditMode = (feature) => {
        this.currentFeature = feature;
        this.updateMeasurementResults(this.currentFeature, false);
        if (this.drawInteraction.getActive()) {
            this.drawInteraction.setActive(false);
            this.selectInteraction.setActive(true);
            this.modifyInteraction.setActive(true);
            this.selectInteraction.getFeatures().clear();
            this.selectInteraction.getFeatures().push(this.currentFeature);
        }
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
            const features = this.props.map.getFeaturesAtPixel(evt.pixel, {hitTolerance: 5, layerFilter: layer => layer === this.measureLayer});
            if (features.length === 0) {
                this.leaveEditMode();
                // Immediately start new drawing
                const clickCoord = MapUtils.getHook(MapUtils.GET_SNAPPED_COORDINATES_FROM_PIXEL_HOOK)(evt.pixel);
                this.drawInteraction.appendCoordinates([clickCoord]);
                if (this.props.measurement.mode === 'Point') {
                    // Ughh... Apparently we need to wait 250ms for the 'singleclick' event processing to finish to avoid pick interactions picking up the current event
                    setTimeout(() => this.drawInteraction.finishDrawing(), 300);
                }
            } else {
                this.enterEditMode(features[0]);
            }
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
        const measureMode = feature.get('measureMode');
        const settings = {
            lenUnit: this.props.measurement.lenUnit,
            areaUnit: this.props.measurement.areaUnit,
            displayCrs: this.props.displayCrs,
            showPerimeterLength: this.props.measurement.showPerimeterLength
        };
        MeasureUtils.updateFeatureMeasurements(feature, measureMode, this.props.projection, settings);

        this.measureLayer.getSource().changed();
        this.props.changeMeasurementState({
            mode: measureMode,
            drawing: drawing,
            measureId: feature.getId(),
            coordinates: feature.getGeometry().getCoordinates(),
            ...structuredClone(feature.get('measurements'))
        });
    };
    featureStyleFunction = (feature) => {
        const opts = computeMeasureFeatureStyle(this.endMarkerOptions(feature));
        const styles = [...FeatureStyles.default(feature, opts)];
        if (feature === this.currentFeature) {
            const geometryFunction = (f) => {
                if (f.getGeometry().getType() === "Point") {
                    return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
                } else if (f.getGeometry().getType() === "LineString") {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
                }
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
            };
            styles.push(FeatureStyles.measureInteractionVertex({geometryFunction}));
        }
        return styles;
    };
    endMarkerOptions = (feature) => {
        const opts = {};
        const measureMode = feature.get('measureMode');
        if (measureMode === 'LineString') {
            opts.headmarker = this.props.measurement.lineHeadMarker;
            opts.tailmarker = this.props.measurement.lineTailMarker;
        } else if (measureMode === 'Bearing') {
            opts.headmarker = this.props.measurement.bearingHeadMarker;
            opts.tailmarker = this.props.measurement.bearingTailMarker;
        }
        opts.markerscale = this.props.measurement.markerScale;
        return opts;
    };
}

export default connect((state) => ({
    displayCrs: state.map.displayCrs,
    measurement: state.measurement
}), {
    addLayerFeatures,
    changeMeasurementState,
    removeLayer
})(MeasurementSupport);

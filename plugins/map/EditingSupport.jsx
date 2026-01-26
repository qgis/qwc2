/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {setEditContext} from '../../actions/editing';
import LocationRecorder from '../../components/LocationRecorder';
import MeasureSwitcher from '../../components/MeasureSwitcher';
import {BottomToolPortalContext} from '../../components/PluginsContainer';
import FeatureStyles from "../../utils/FeatureStyles";
import MeasureUtils from '../../utils/MeasureUtils';

/**
 * Editing support for the map component.
 */
class EditingSupport extends React.Component {
    static contextType = BottomToolPortalContext;
    static propTypes = {
        displayCrs: PropTypes.string,
        editContext: PropTypes.object,
        editContexts: PropTypes.object,
        map: PropTypes.object,
        mapCrs: PropTypes.string,
        setEditContext: PropTypes.func
    };
    constructor(props) {
        super(props);

        this.interaction = null;
        this.layers = {};
        this.currentLayer = null;
        this.currentFeature = null;
    }
    state = {
        showRecordLocation: false,
        measurements: {showmeasurements: false, lenUnit: 'metric', areaUnit: 'metric'}
    };
    componentDidUpdate(prevProps, prevState) {
        const curContext = this.props.editContext;
        const prevContext = prevProps.editContext;
        if (curContext === prevContext) {
            // pass
        } else if (curContext.action === 'Pick' && curContext.feature) {
            // If a feature without geometry was picked, enter draw mode, otherwise enter edit mode
            if (!curContext.feature.geometry && curContext.geomType) {
                this.addDrawInteraction();
            } else {
                this.addEditInteraction();
            }
        } else if (curContext.action === 'Draw' && curContext.geomType) {
            // Usually, draw mode starts without a feature, but draw also can start with a pre-set geometry
            if (!(curContext.feature || {}).geometry || (prevContext.id === curContext.id && prevContext.geomType !== curContext.geomType)) {
                this.addDrawInteraction();
            } else if ((curContext.feature || {}).geometry) {
                this.addEditInteraction();
            }
        } else {
            this.reset();
        }
        if (this.state.measurements !== prevState.measurements) {
            this.updateMeasurements();
        }
        if (this.props.editContexts !== prevProps.editContexts) {
            this.cleanupLayers(prevProps.editContexts);
        }
    }
    render() {
        let locationRecorder = null;
        let measureSwitcher = null;
        if (this.state.showRecordLocation && this.props.editContext.geomType) {
            const geomType = this.props.editContext.geomType.replace(/Z$/, '');
            locationRecorder = (
                <LocationRecorder
                    drawInteraction={this.interaction} geomType={geomType} key="LocationRecorder" map={this.props.map} />
            );
        }
        if (this.props.editContext.action === "Draw" || this.props.editContext.feature?.geometry) {
            measureSwitcher = ReactDOM.createPortal((
                <MeasureSwitcher
                    changeMeasureState={this.changeMeasurementState}
                    geomType={this.props.editContext.geomType}
                    iconSize="large" key="MeasureSwitcher"
                    measureState={this.state.measurements}
                />
            ), this.context);
        }
        return [measureSwitcher, locationRecorder];
    }
    changeMeasurementState = (diff) => {
        this.setState(state => ({measurements: {...state.measurements, ...diff}}));
    };
    editStyle = (feature) => {
        const geometryFunction = (f) => {
            if (f.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
            } else if (f.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
            } else if (f.getGeometry().getType() === "Polygon") {
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
            } else if (f.getGeometry().getType() === "MultiPoint") {
                return f.getGeometry();
            } else if (f.getGeometry().getType() === "MultiLineString") {
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
            } else if (f.getGeometry().getType() === "MultiPolygon") {
                return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0][0]);
            }
            return f.getGeometry();
        };
        return [
            FeatureStyles.interaction(feature, this.props.editContext.geometryStyle),
            FeatureStyles.interactionVertex({geometryFunction, ...this.props.editContext.vertexStyle})
        ].flat();
    };
    setCurrentLayer = () => {
        if (!(this.props.editContext.id in this.layers)) {
            this.layers[this.props.editContext.id] = new ol.layer.Vector({
                source: new ol.source.Vector(),
                zIndex: 1000000,
                style: this.editStyle
            });
            this.props.map.addLayer(this.layers[this.props.editContext.id]);
        }
        this.currentLayer = this.layers[this.props.editContext.id];
    };
    addDrawInteraction = () => {
        this.reset();
        this.setCurrentLayer();
        const geomType = this.props.editContext.geomType.replace(/Z$/, '');
        const drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            type: geomType,
            source: this.currentLayer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: this.editStyle
        });
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
            this.currentFeature.on('change', this.updateMeasurements);
        }, this);
        drawInteraction.on('drawend', () => {
            this.setState({showRecordLocation: false});
            this.commitCurrentFeature();
            this.props.map.removeInteraction(drawInteraction);
            this.interaction = null;
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interaction = drawInteraction;
        this.setState({showRecordLocation: ["Point", "LineString", "MultiPoint", "MultiLineString"].includes(geomType)});
    };
    addEditInteraction = () => {
        this.reset();
        this.setCurrentLayer();
        const format = new ol.format.GeoJSON();
        this.currentFeature = format.readFeature(this.props.editContext.feature);
        this.currentFeature.on('change', this.updateMeasurements);
        this.updateMeasurements();
        this.currentLayer.getSource().addFeature(this.currentFeature);

        const modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection([this.currentFeature]),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                if (event.type === "pointerdown" && ol.events.condition.shiftKeyOnly(event)) {
                    this.props.map.setIgnoreNextClick(true);
                }
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            },
            style: FeatureStyles.sketchInteraction()
        });
        modifyInteraction.on('modifyend', () => {
            this.commitCurrentFeature();
        }, this);
        modifyInteraction.setActive(
            this.props.editContext.geomType && this.props.editContext.permissions.updatable &&
            this.props.editContext.editConfig?.permissions?.updatable === true &&
            !this.props.editContext.geomReadOnly && !this.props.editContext.geomNonZeroZ
        );
        this.props.map.addInteraction(modifyInteraction);
        this.interaction = modifyInteraction;
    };
    updateMeasurements = () => {
        if (!this.currentFeature) {
            return;
        } else if (!this.state.measurements?.showmeasurements) {
            this.currentFeature.set('measurements', undefined);
            this.currentFeature.set('segment_labels', undefined);
            this.currentFeature.set('label', undefined);
        } else {
            const settings = {
                displayCrs: this.props.displayCrs,
                lenUnit: this.state.measurements.lenUnit,
                areaUnit: this.state.measurements.areaUnit
            };
            MeasureUtils.updateFeatureMeasurements(this.currentFeature, this.props.editContext.geomType, this.props.mapCrs, settings);
        }
    };
    commitCurrentFeature = () => {
        if (!this.currentFeature) {
            return;
        }
        const format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        if (this.props.editContext.feature) {
            feature = {...this.props.editContext.feature, geometry: feature.geometry};
        }
        const addZCoordinateIfNeeded = (entry) => Array.isArray(entry[0]) ? entry.map(addZCoordinateIfNeeded) : [...entry.slice(0, 2), 0];
        if (this.props.editContext.geomType.endsWith('Z')) {
            feature.geometry.coordinates = addZCoordinateIfNeeded(feature.geometry.coordinates);
        }
        this.props.setEditContext(this.props.editContext.id, {feature: feature, changed: true});
    };
    reset = () => {
        if (this.interaction) {
            this.props.map.removeInteraction(this.interaction);
        }
        this.interaction = null;
        if (this.currentFeature) {
            this.currentFeature.un('change', this.updateMeasurements);
        }
        this.currentFeature = null;
        if (this.layers[this.props.editContext.id]) {
            this.layers[this.props.editContext.id].getSource().clear();
        }
    };
    cleanupLayers = (prevContexts) => {
        const currentContexts = new Set(Object.keys(this.props.editContexts));
        const removedContexts = Object.keys(prevContexts).filter(item => !currentContexts.has(item));
        removedContexts.forEach(id => {
            if (this.layers[id]) {
                this.props.map.removeLayer(this.layers[id]);
                delete this.layers[id];
            }
        });
    };
}

export default connect((state) => ({
    editContexts: state.editing.contexts,
    editContext: state.editing.contexts[state.editing.currentContext] || {},
    displayCrs: state.map.displayCrs,
    mapCrs: state.map.projection
}), {
    setEditContext: setEditContext
})(EditingSupport);

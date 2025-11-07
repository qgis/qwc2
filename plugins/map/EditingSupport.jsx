/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {setEditContext} from '../../actions/editing';
import LocationRecorder from '../../components/LocationRecorder';
import FeatureStyles from "../../utils/FeatureStyles";

/**
 * Editing support for the map component.
 */
class EditingSupport extends React.Component {
    static propTypes = {
        editContext: PropTypes.object,
        map: PropTypes.object,
        setEditContext: PropTypes.func
    };
    constructor(props) {
        super(props);

        this.interaction = null;
        this.layer = null;
        this.currentFeature = null;
    }
    state = {
        showRecordLocation: false
    };
    componentDidUpdate(prevProps) {
        if (this.props.editContext === prevProps.editContext) {
            // pass
        } else if (this.props.editContext.action === 'Pick' && this.props.editContext.feature) {
            // If a feature without geometry was picked, enter draw mode, otherwise enter edit mode
            if (!this.props.editContext.feature.geometry && this.props.editContext.geomType) {
                this.addDrawInteraction();
            } else {
                this.addEditInteraction();
            }
        } else if (this.props.editContext.action === 'Draw' && this.props.editContext.geomType) {
            // Usually, draw mode starts without a feature, but draw also can start with a pre-set geometry
            if (!(this.props.editContext.feature || {}).geometry || prevProps.editContext.geomType !== this.props.editContext.geomType) {
                this.addDrawInteraction();
            } else if ((this.props.editContext.feature || {}).geometry) {
                this.addEditInteraction();
            }
        } else {
            this.reset();
        }
    }
    render() {
        if (this.state.showRecordLocation) {
            const geomType = this.props.editContext.geomType.replace(/Z$/, '');
            return (
                <LocationRecorder
                    drawInteraction={this.interaction} geomType={geomType} key="LocationRecorder" map={this.props.map} />
            );
        }
        return null;
    }
    editStyle = () => {
        const geometryFunction = (feature) => {
            if (feature.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
            } else if (feature.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
            } else if (feature.getGeometry().getType() === "Polygon") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
            } else if (feature.getGeometry().getType() === "MultiPoint") {
                return feature.getGeometry();
            } else if (feature.getGeometry().getType() === "MultiLineString") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
            } else if (feature.getGeometry().getType() === "MultiPolygon") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0][0]);
            }
            return feature.getGeometry();
        };
        return [
            FeatureStyles.interaction(this.props.editContext.geometryStyle),
            FeatureStyles.interactionVertex({geometryFunction, ...this.props.editContext.vertexStyle})
        ];
    };
    createLayer = () => {
        const source = new ol.source.Vector();
        this.layer = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: this.editStyle()
        });
        this.props.map.addLayer(this.layer);
    };
    addDrawInteraction = () => {
        this.reset();
        this.createLayer();
        const geomType = this.props.editContext.geomType.replace(/Z$/, '');
        const drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            type: geomType,
            source: this.layer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: this.editStyle()
        });
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
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
        this.createLayer();
        const format = new ol.format.GeoJSON();
        this.currentFeature = format.readFeature(this.props.editContext.feature);
        this.layer.getSource().addFeature(this.currentFeature);

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
            !this.props.editContext.geomReadOnly && !this.props.editContext.geomNonZeroZ
        );
        this.props.map.addInteraction(modifyInteraction);
        this.interaction = modifyInteraction;
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
        this.currentFeature = null;
        if (this.layer) {
            this.props.map.removeLayer(this.layer);
        }
        this.layer = null;
    };
}

export default connect((state) => ({
    editContext: state.editing.contexts[state.editing.currentContext] || {}
}), {
    setEditContext: setEditContext
})(EditingSupport);

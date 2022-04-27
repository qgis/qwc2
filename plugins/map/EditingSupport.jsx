/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import uuid from 'uuid';
import ol from 'openlayers';
import {changeEditingState} from '../../actions/editing';

class EditingSupport extends React.Component {
    static propTypes = {
        changeEditingState: PropTypes.func,
        editing: PropTypes.object,
        map: PropTypes.object
    }
    static defaultProps = {
        editing: {}
    }
    constructor(props) {
        super(props);

        this.interaction = null;
        this.layer = null;
        this.currentFeature = null;
        this.editStyle = [
            new ol.style.Style({
                fill: new ol.style.Fill({ color: [255, 0, 0, 0.5] }),
                stroke: new ol.style.Stroke({ color: 'red', width: 2})
            }),
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({color: 'white'}),
                    stroke: new ol.style.Stroke({color: 'red', width: 2}),
                    points: 4,
                    radius: 5,
                    angle: Math.PI / 4
                }),
                geometry: (feature) => {
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
                    } else {
                        return feature.getGeometry();
                    }
                }
            })
        ];
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.editing === prevProps.editing) {
            // pass
        } else if (this.props.editing.action === 'Pick' && this.props.editing.feature) {
            // If a feature without geometry was picked, enter draw mode, otherwise enter edit mode
            if (!this.props.editing.feature.geometry && this.props.editing.geomType) {
                this.addDrawInteraction(this.props);
            } else {
                this.addEditInteraction(this.props);
            }
        } else if (this.props.editing.action === 'Draw' && this.props.editing.geomType) {
            // Usually, draw mode starts without a feature, but draw also can start with a pre-set geometry
            if (!this.props.editing.feature || prevProps.editing.geomType !== this.props.editing.geomType) {
                this.addDrawInteraction(this.props);
            } else if (this.props.editing.feature) {
                this.addEditInteraction(this.props);
            }
        } else {
            this.reset();
        }
    }
    render() {
        return null;
    }
    createLayer = () => {
        const source = new ol.source.Vector();
        this.layer = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: this.editStyle
        });
        this.props.map.addLayer(this.layer);
    }
    addDrawInteraction = (newProps) => {
        this.reset();
        this.createLayer();
        const drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            type: newProps.editing.geomType,
            source: this.layer.getSource(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: this.editStyle
        });
        drawInteraction.set('snapping', this.props.editing.snapping);
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
        }, this);
        drawInteraction.on('drawend', () => {
            this.commitCurrentFeature();
            this.props.map.removeInteraction(drawInteraction);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interaction = drawInteraction;
    }
    addEditInteraction = (newProps) => {
        this.reset();
        this.createLayer();
        const format = new ol.format.GeoJSON();
        this.currentFeature = format.readFeature(newProps.editing.feature);
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
            }
        });
        modifyInteraction.set('snapping', this.props.editing.snapping);
        modifyInteraction.on('modifyend', () => {
            this.commitCurrentFeature();
        }, this);
        this.props.map.addInteraction(modifyInteraction);
        this.interaction = modifyInteraction;
    }
    commitCurrentFeature = () => {
        if (!this.currentFeature) {
            return;
        }
        const format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        if (this.props.editing.feature) {
            feature = {...this.props.editing.feature, geometry: feature.geometry};
        }
        this.props.changeEditingState({feature: feature, changed: true});
    }
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
    }
}

export default connect((state) => ({
    editing: state.editing
}), {
    changeEditingState: changeEditingState
})(EditingSupport);

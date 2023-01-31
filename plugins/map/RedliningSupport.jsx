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
import {changeRedliningState} from '../../actions/redlining';
import {LayerRole, addLayerFeatures, removeLayerFeatures} from '../../actions/layers';
import {OlLayerAdded, OlLayerUpdated} from '../../components/map/OlLayer';
import FeatureStyles from '../../utils/FeatureStyles';
import SnapInteraction from './SnapInteraction';

const DrawStyle = new ol.style.Style({
    image: new ol.style.Circle({
        fill: new ol.style.Fill({color: '#0099FF'}),
        stroke: new ol.style.Stroke({color: '#FFFFFF', width: 1.5}),
        radius: 6
    })
});

class RedliningSupport extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        changeRedliningState: PropTypes.func,
        map: PropTypes.object,
        redlining: PropTypes.object,
        removeLayerFeatures: PropTypes.func,
        snappingConfig: PropTypes.object
    }
    static defaultProps = {
        redlining: {}
    }
    constructor(props) {
        super(props);

        this.interactions = [];
        this.snapInteraction = null;
        this.picking = false;
        this.currentFeature = null;
        this.selectedTextStyle = (feature, opts) => new ol.style.Style({
            text: new ol.style.Text({
                font: '10pt sans-serif',
                text: feature.getProperties().label || "",
                scale: opts.strokeWidth,
                fill: new ol.style.Fill({color: opts.fillColor}),
                stroke: new ol.style.Stroke({color: [0, 0, 0, 0.5], width: 4})
            })
        });
        this.selectedStyle = new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: 'white'}),
                stroke: new ol.style.Stroke({color: 'red', width: 2}),
                points: 4,
                radius: 5,
                angle: Math.PI / 4
            }),
            geometry: (f) => {
                if (f.getGeometry().getType() === "Point") {
                    return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
                } else if (f.getGeometry().getType() === "LineString") {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
                } else if (f.getGeometry().getType() === "Polygon") {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
                } else if (f.getGeometry().getType() === "Circle") {
                    const center = f.getGeometry().getCenter();
                    return new ol.geom.MultiPoint([center, [center[0] + f.getGeometry().getRadius(), center[1]]]);
                }
                return null;
            }
        });
    }
    componentDidUpdate(prevProps, prevState) {
        const layerChanged = this.props.redlining.layer !== prevProps.redlining.layer;
        if (this.props.redlining === prevProps.redlining) {
            // pass
        } else if (!this.props.redlining || !this.props.redlining.action) {
            this.reset(layerChanged);
        } else if ((this.props.redlining.action === 'Pick' || this.props.redlining.action === 'Buffer') && (prevProps.redlining.action !== this.props.redlining.action || layerChanged || (!this.props.redlining.selectedFeature && prevProps.redlining.selectedFeature))) {
            this.addPickInteraction(layerChanged);
        } else if (this.props.redlining.action === 'Delete') {
            this.deleteCurrentFeature(prevProps);
        } else if (this.props.redlining.action === 'Draw' && (prevProps.redlining.action !== 'Draw' || this.props.redlining.geomType !== prevProps.redlining.geomType || layerChanged)) {
            this.addDrawInteraction(layerChanged);
        } else if (this.props.redlining.freehand !== prevProps.redlining.freehand) {
            this.addDrawInteraction(layerChanged);
        } else if (this.props.redlining.style !== prevProps.redlining.style) {
            this.updateFeatureStyle(this.props.redlining.style);
        }
        if (this.snapInteraction && this.props.snappingConfig.active !== prevProps.snappingConfig.active) {
            this.snapInteraction.setActive(this.props.snappingConfig.active);
        }
    }
    render() {
        return null;
    }
    styleOptions = (style) => {
        return {
            strokeColor: style.borderColor,
            strokeWidth: 1 + 0.5 * style.size,
            fillColor: style.fillColor,
            circleRadius: 5 + style.size,
            strokeDash: []
        };
    }
    styleProps = (feature) => {
        const styleOptions = feature.get('styleOptions');
        const label = feature.get("label") || "";
        return {
            borderColor: styleOptions.strokeColor,
            size: (styleOptions.strokeWidth - 1) * 2,
            fillColor: styleOptions.fillColor,
            text: label
        };
    }
    updateFeatureStyle = (styleProps) => {
        if (this.currentFeature) {
            const isText = this.currentFeature.get("isText") === true;
            const styleName = isText ? "text" : "default";
            this.currentFeature.set('label', styleProps.text);
            const opts = this.styleOptions(styleProps);
            const style = FeatureStyles[styleName](this.currentFeature, opts);
            const styles = [];
            if (isText) {
                styles.push(this.selectedTextStyle(this.currentFeature, opts));
            }
            this.currentFeature.setStyle(styles.concat(style, this.selectedStyle));
            this.currentFeature.set('styleName', styleName);
            this.currentFeature.set('styleOptions', opts);
        }
    }
    addDrawInteraction = (layerChanged) => {
        this.reset(layerChanged);
        const typeMap = {
            Text: "Point",
            Point: "Point",
            LineString: "LineString",
            Polygon: "Polygon",
            Circle: "Circle",
            Box: "Circle"
        };
        const isText = this.props.redlining.geomType === "Text";
        const isFreeHand = this.props.redlining.freehand;
        const drawInteraction = new ol.interaction.Draw({
            stopClick: true,
            type: typeMap[this.props.redlining.geomType],
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: () => { return this.picking ? [] : DrawStyle; },
            freehand: isFreeHand,
            geometryFunction: this.props.redlining.geomType === "Box" ? ol.interaction.createBox() : undefined
        });
        drawInteraction.on('drawstart', (evt) => {
            if (this.picking && this.props.redlining.drawMultiple === false) {
                return;
            }
            this.leaveTemporaryPickMode();
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
            this.currentFeature.set('isText', isText);
            this.updateFeatureStyle(this.props.redlining.style);
        }, this);
        drawInteraction.on('drawend', () => {
            const feature = this.currentFeature;
            this.commitCurrentFeature(true);
            this.enterTemporaryPickMode(feature, this.props.redlining.layer);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions = [drawInteraction];
        if (this.props.snappingConfig.enabled) {
            const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
            if (redliningLayer) {
                this.snapInteraction = new SnapInteraction({source: redliningLayer.getSource()});
                this.snapInteraction.setActive(this.props.snappingConfig.active);
                this.props.map.addInteraction(this.snapInteraction);
            }
        }
    }
    waitForFeatureAndLayer = (layerId, featureId, callback) => {
        const redliningLayer = this.searchRedliningLayer(layerId);
        if (!redliningLayer) {
            OlLayerAdded.connect((layer) => {
                if (layer.get("id") === layerId) {
                    const feature = layer.getSource().getFeatureById(featureId);
                    callback(layer, feature);
                    return true;
                }
                return false;
            });
        } else {
            const feature = redliningLayer.getSource().getFeatureById(featureId);
            if (feature) {
                callback(redliningLayer, feature);
            } else {
                OlLayerUpdated.connect((layer) => {
                    const feat = layer.getSource().getFeatureById(featureId);
                    if (layer.get("id") === layerId && feat) {
                        callback(layer, feat);
                        return true;
                    }
                    return false;
                });
            }
        }
    }
    enterTemporaryPickMode = (featureId, layerId) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.currentFeature = feature;
            const circle = this.currentFeature.get('circleParams');
            if (circle) {
                this.currentFeature.setGeometry(new ol.geom.Circle(circle.center, circle.radius));
            }
            this.updateFeatureStyle(this.props.redlining.style);

            if (this.props.redlining.geomType === "Box") {
                // Disable a-posteriori editing of box, as editing does not enforce the box geometry (but edits it as a polygon)
                this.interactions.push(new ol.interaction.Interaction({}));
            } else {
                const modifyInteraction = new ol.interaction.Modify({
                    features: new ol.Collection([this.currentFeature]),
                    condition: (event) => {
                        return event.originalEvent.buttons === 1;
                    },
                    deleteCondition: (event) => {
                        // delete vertices on SHIFT + click
                        if (event.type === "pointerdown" && ol.events.condition.shiftKeyOnly(event)) {
                            this.props.map.setIgnoreNextClick(true);
                        }
                        return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
                    }
                });
                modifyInteraction.on('modifyend', () => {
                    this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
                });
                this.props.map.addInteraction(modifyInteraction);
                if (this.snapInteraction) {
                    this.props.map.removeInteraction(this.snapInteraction);
                    // Reorder as last
                    this.props.map.addInteraction(this.snapInteraction);
                } else if (this.props.snappingConfig.enabled) {
                    // Snapping interaction was not created previously as layer did not yet exist
                    this.snapInteraction = new SnapInteraction({source: redliningLayer.getSource()});
                    this.snapInteraction.setActive(this.props.snappingConfig.active);
                    this.props.map.addInteraction(this.snapInteraction);
                }
                this.interactions.push(modifyInteraction);
            }
            this.picking = true;
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
    }
    leaveTemporaryPickMode = () => {
        if (this.currentFeature) {
            this.commitCurrentFeature();
        }
        if (this.picking) {
            // Remove modify interactions
            this.props.map.removeInteraction(this.interactions.pop());
            // If snapping interaction was added, it will remain as last interaction
            this.picking = false;
        }
    }
    addPickInteraction = (layerChanged) => {
        this.reset(layerChanged);
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (!redliningLayer) {
            return;
        }

        const selectInteraction = new ol.interaction.Select({layers: [redliningLayer], hitTolerance: 5});
        const modifyInteraction = new ol.interaction.Modify({
            features: selectInteraction.getFeatures(),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                if (event.type === "pointerdown" && ol.events.condition.shiftKeyOnly(event)) {
                    this.props.map.setIgnoreNextClick(true);
                }
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            }
        });
        selectInteraction.on('select', (evt) => {
            if (evt.selected.length === 1 && evt.selected[0] === this.currentFeature) {
                return;
            }
            if (this.currentFeature) {
                this.commitCurrentFeature();
            }
            if (this.snapInteraction) {
                this.props.map.removeInteraction(this.snapInteraction);
            }
            if (evt.selected.length === 1) {
                this.currentFeature = evt.selected[0];
                const circle = this.currentFeature.get('circleParams');
                if (circle) {
                    this.currentFeature.setGeometry(new ol.geom.Circle(circle.center, circle.radius));
                }
                const newRedliningState = {
                    geomType: this.currentFeature.get("isText") === true ? 'Text' : this.currentFeature.getGeometry().getType(),
                    style: this.styleProps(this.currentFeature),
                    selectedFeature: this.currentFeatureObject()
                };
                this.updateFeatureStyle(newRedliningState.style);
                this.props.changeRedliningState(newRedliningState);
                this.props.map.addInteraction(modifyInteraction);
                if (this.props.snappingConfig.enabled) {
                    this.snapInteraction = new SnapInteraction({source: redliningLayer.getSource()});
                    this.snapInteraction.setActive(this.props.snappingConfig.active);
                    this.props.map.addInteraction(this.snapInteraction);
                }
            } else {
                this.props.changeRedliningState({geomType: null, selectedFeature: null});
                this.props.map.removeInteraction(modifyInteraction);
            }
        }, this);
        modifyInteraction.on('modifyend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        this.props.map.addInteraction(selectInteraction);
        this.interactions = [selectInteraction, modifyInteraction];
        this.picking = true;
    }
    commitCurrentFeature = (newFeature = false) => {
        if (!this.currentFeature) {
            return;
        }
        this.updateFeatureStyle(this.props.redlining.style);
        const isText = this.currentFeature.get("isText") === true;
        if (isText && !this.currentFeature.get("label")) {
            if (!newFeature) {
                this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()]);
            }
            this.resetSelectedFeature();
            return;
        }
        const format = new ol.format.GeoJSON();
        const feature = format.writeFeatureObject(this.currentFeature);
        if (this.currentFeature.getGeometry() instanceof ol.geom.Circle) {
            const center = this.currentFeature.getGeometry().getCenter();
            const radius = this.currentFeature.getGeometry().getRadius();
            const deg2rad = Math.PI / 180;
            feature.geometry.type = "Polygon";
            feature.geometry.coordinates = [
                Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))
            ];
            feature.circleParams = {
                center: center,
                radius: radius
            };
        }
        feature.isText = isText;
        feature.styleName = this.currentFeature.get('styleName');
        feature.styleOptions = this.currentFeature.get('styleOptions');
        delete feature.properties.styleName;
        delete feature.properties.styleOptions;
        delete feature.properties.isText;
        delete feature.properties.circleParams;
        if (feature.properties.label === "") {
            delete feature.properties.label;
        }
        const layer = {
            id: this.props.redlining.layer,
            title: this.props.redlining.layerTitle,
            role: LayerRole.USERLAYER,
            queryable: false
        };
        this.props.addLayerFeatures(layer, [feature]);
        this.resetSelectedFeature();
    }
    deleteCurrentFeature = (oldProps) => {
        if (this.currentFeature) {
            this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()], true);
            this.currentFeature = null;
            this.props.changeRedliningState({...oldProps.redlining, selectedFeature: null});
        }
    }
    reset = (layerChanged = false) => {
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if (this.snapInteraction) {
            this.props.map.removeInteraction(this.snapInteraction);
            this.snapInteraction = null;
        }
        if (this.picking && !layerChanged) {
            this.commitCurrentFeature();
        } else {
            this.resetSelectedFeature();
        }
        this.picking = false;
    }
    resetSelectedFeature = () => {
        if (this.currentFeature) {
            // Reset selection style
            const isText = this.currentFeature.get("isText") === true;
            const style = FeatureStyles[isText ? "text" : "default"](this.currentFeature, this.currentFeature.get('styleOptions'));
            this.currentFeature.setStyle(style);
            this.currentFeature = null;
            this.props.changeRedliningState({selectedFeature: null});
        }
    }
    searchRedliningLayer = (layerId) => {
        let redliningLayer = null;
        this.props.map.getLayers().forEach(olLayer => {
            if (olLayer.get('msId') === layerId) {
                redliningLayer = olLayer;
            }
        });
        return redliningLayer;
    }
    currentFeatureObject = () => {
        if (!this.currentFeature) {
            return null;
        }
        const format = new ol.format.GeoJSON();
        return format.writeFeatureObject(this.currentFeature);
    }
}

export default connect((state) => ({
    redlining: state.redlining,
    snappingConfig: state.map.snapping
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

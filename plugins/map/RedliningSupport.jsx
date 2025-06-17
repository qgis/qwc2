/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import Mousetrap from 'mousetrap';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayerFeatures} from '../../actions/layers';
import {changeRedliningState} from '../../actions/redlining';
import NumericInputWindow from '../../components/NumericInputWindow';
import {OlLayerAdded, OlLayerUpdated} from '../../components/map/OlLayer';
import FeatureStyles from '../../utils/FeatureStyles';
import MapUtils from '../../utils/MapUtils';
import MeasureUtils from '../../utils/MeasureUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';

const GeomTypeConfig = {
    Text: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Point"}), editTool: 'Pick', drawNodes: true},
    Point: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Point"}), editTool: 'Pick', drawNodes: true},
    LineString: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "LineString"}), editTool: 'Pick', drawNodes: true},
    Polygon: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Polygon"}), editTool: 'Pick', drawNodes: true},
    Circle: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Circle"}), editTool: 'Pick', drawNodes: true, regular: true},
    Ellipse: {drawInteraction: (opts) => new ol.interaction.DrawRegular({...opts, sides: 0}), editTool: 'Transform', drawNodes: false},
    Box: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Circle", geometryFunction: ol.interaction.createBox()}), editTool: 'Transform', drawNodes: true},
    Square: {drawInteraction: (opts) => new ol.interaction.DrawRegular({...opts, sides: 4, squareCondition: () => true }), editTool: 'Transform', regular: true}
};

/**
 * Redlining support for the map component.
 */
class RedliningSupport extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        changeRedliningState: PropTypes.func,
        displayCrs: PropTypes.string,
        map: PropTypes.object,
        mapCrs: PropTypes.string,
        redlining: PropTypes.object,
        removeLayerFeatures: PropTypes.func
    };
    static defaultProps = {
        redlining: {}
    };
    constructor(props) {
        super(props);

        this.interactions = [];
        this.picking = false;
        this.currentFeature = null;
        this.blockOnChange = false;
        this.selectedTextStyle = (feature, opts) => new ol.style.Style({
            text: new ol.style.Text({
                font: '10pt sans-serif',
                text: feature.getProperties().label || "",
                rotation: feature.getProperties().rotation || 0,
                scale: opts.strokeWidth,
                fill: new ol.style.Fill({color: opts.textFillColor}),
                stroke: new ol.style.Stroke({color: [0, 0, 0, 0.5], width: 4})
            })
        });
        const geometryFunction = (feature) => {
            if (feature.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
            } else if (feature.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
            } else if (feature.getGeometry().getType() === "Polygon") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
            } else if (feature.getGeometry().getType() === "Circle") {
                const center = feature.getGeometry().getCenter();
                return new ol.geom.MultiPoint([center, [center[0] + feature.getGeometry().getRadius(), center[1]]]);
            }
            return null;
        };
        this.selectedStyle = FeatureStyles.interactionVertex({geometryFunction});
    }
    componentDidUpdate(prevProps) {
        // Bind keyboard shortcuts to delete features
        if (this.props.redlining.action && !prevProps.redlining.action) {
            Mousetrap.bind('del', this.triggerDelete);
            Mousetrap.bind('backspace', this.triggerDelete);
        } else if (!this.props.redlining.action && prevProps.redlining.action) {
            Mousetrap.unbind('del', this.triggerDelete);
            Mousetrap.unbind('backspace', this.triggerDelete);
        }
        // Handle delete action immediately and reset the redlining state to the previous action
        if (this.props.redlining.action === 'Delete') {
            this.deleteCurrentFeature();
            this.props.changeRedliningState({...prevProps.redlining, selectedFeature: null});
            return;
        }
        const recreateInteraction = (
            this.props.redlining.action !== prevProps.redlining.action ||
            this.props.redlining.layer !== prevProps.redlining.layer ||
            (['Draw', 'PickDraw'].includes(this.props.redlining.action) && this.props.redlining.geomType !== prevProps.redlining.geomType) ||
            this.props.redlining.freehand !== prevProps.redlining.freehand ||
            this.props.redlining.drawMultiple !== prevProps.redlining.drawMultiple
        );
        if (recreateInteraction) {
            // Commit to previous layer in case layer changed
            this.reset(prevProps.redlining);
            if (this.props.redlining.action === 'Draw') {
                this.addDrawInteraction();
            } else if (this.props.redlining.action === 'Transform') {
                this.addTransformInteraction();
            } else if (this.props.redlining.action === 'Pick' || this.props.redlining.action === 'Buffer') {
                this.addPickInteraction();
            } else if (this.props.redlining.action === 'PickDraw') {
                this.addPickDrawInteraction();
            }
        }
        if (this.currentFeature) {
            // Update feature style
            if (this.props.redlining.style !== prevProps.redlining.style) {
                this.updateFeatureStyle(this.props.redlining.style);
            }
            // Update current feature measurements
            if (
                this.props.map.displayCrs !== prevProps.map.displayCrs ||
                this.props.redlining.measurements !== prevProps.redlining.measurements ||
                this.props.redlining.lenUnit !== prevProps.redlining.lenUnit ||
                this.props.redlining.areaUnit !== prevProps.redlining.areaUnit
            ) {
                this.currentFeature.changed();
            }
        }
    }
    render() {
        if (this.props.redlining.numericInput) {
            return (
                <NumericInputWindow
                    feature={this.props.redlining.selectedFeature}
                    onClose={() => this.props.changeRedliningState({numericInput: false})}
                    onFeatureChanged={this.updateCurrentFeature} />
            );
        }
        return null;
    }
    updateCurrentFeature = (feature) => {
        if (this.currentFeature && this.props.redlining.selectedFeature) {
            if (feature.circleParams) {
                const circleParams = feature.circleParams;
                this.currentFeature.setGeometry(new ol.geom.Circle(circleParams.center, circleParams.radius));
            } else {
                this.currentFeature.getGeometry().setCoordinates(feature.geometry.coordinates);
            }
            this.props.changeRedliningState({selectedFeature: feature, geomType: feature.shape});
        }
    };
    styleOptions = (styleProps, isText) => {
        return {
            strokeColor: isText ? styleProps.textOutlineColor : styleProps.borderColor,
            strokeWidth: 1 + 0.5 * styleProps.size,
            fillColor: isText ? styleProps.textFillColor : styleProps.fillColor,
            circleRadius: 5 + styleProps.size,
            strokeDash: [],
            headmarker: styleProps.headmarker,
            tailmarker: styleProps.tailmarker
        };
    };
    styleProps = (feature) => {
        const styleOptions = feature.get('styleOptions');
        const label = feature.get("label") || "";
        const isText = feature.get("shape") === "Text";
        return {
            [isText ? "textOutlineColor" : "borderColor"]: styleOptions.strokeColor,
            size: (styleOptions.strokeWidth - 1) * 2,
            [isText ? "textFillColor" : "fillColor"]: styleOptions.fillColor,
            text: label,
            headmarker: styleOptions.headmarker,
            tailmarker: styleOptions.tailmarker
        };
    };
    updateFeatureStyle = (styleProps) => {
        const isText = this.currentFeature.get("shape") === "Text";
        const styleName = isText ? "text" : "default";
        const opts = this.styleOptions(styleProps, isText);
        this.blockOnChange = true;
        this.currentFeature.set('label', styleProps.text);
        this.currentFeature.set('styleName', styleName);
        this.currentFeature.set('styleOptions', opts);
        this.blockOnChange = false;
    };
    styleFunction = (feature) => {
        const styleOptions = feature.get("styleOptions");
        const styleName = feature.get("styleName");
        const styles = [];
        if (styleName === "text") {
            styles.push(this.selectedTextStyle(feature, styleOptions));
        }
        styles.push(...FeatureStyles[styleName](feature, styleOptions));
        const shape = feature.get('shape');
        const geomTypeConfig = GeomTypeConfig[shape];
        if ((geomTypeConfig || {}).drawNodes !== false) {
            styles.push(this.selectedStyle);
        }
        return styles;
    };
    setCurrentFeature = (feature) => {
        this.currentFeature = feature;
        this.currentFeature.setStyle(this.styleFunction);
        const circleParams = this.currentFeature.get('circleParams');
        if (circleParams) {
            this.currentFeature.setGeometry(new ol.geom.Circle(circleParams.center, circleParams.radius));
        }
        const measurements = this.currentFeature.get('measurements');
        const featureObj = this.currentFeatureObject();
        const newRedliningState = {
            style: this.styleProps(this.currentFeature),
            measurements: !!this.currentFeature.get('measurements'),
            selectedFeature: featureObj,
            geomType: featureObj?.shape ?? this.props.redlining.geomType
        };
        if (measurements) {
            newRedliningState.lenUnit = measurements.lenUnit;
            newRedliningState.areaUnit = measurements.areaUnit;
        }
        this.props.changeRedliningState(newRedliningState);

        this.currentFeature.on('change', this.updateMeasurements);
    };
    addDrawInteraction = () => {
        const geomTypeConfig = GeomTypeConfig[this.props.redlining.geomType];
        if (!geomTypeConfig) {
            return;
        }
        const isFreeHand = this.props.redlining.freehand;
        const drawInteraction = geomTypeConfig.drawInteraction({
            stopClick: true,
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: () => { return this.picking ? [] : FeatureStyles.sketchInteraction(); },
            freehand: isFreeHand
        });
        drawInteraction.on('drawstart', (evt) => {
            if (this.picking && this.props.redlining.drawMultiple === false) {
                return;
            }
            this.leaveTemporaryEditMode();
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuidv4());
            this.currentFeature.set('shape', this.props.redlining.geomType);
            this.currentFeature.setStyle(this.styleFunction);
            this.updateFeatureStyle(this.props.redlining.style);
            this.currentFeature.on('change', this.updateMeasurements);
        }, this);
        drawInteraction.on('drawend', () => {
            const featureId = this.currentFeature.getId();
            this.commitCurrentFeature(this.props.redlining, true);
            this.enterTemporaryEditMode(featureId, this.props.redlining.layer, geomTypeConfig.editTool);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions.push(drawInteraction);
    };
    updateMeasurements = () => {
        if (this.blockOnChange || !this.currentFeature) {
            return;
        }
        const feature = this.currentFeature;
        const hadMeasurements = !!feature.get('measurements');
        if (this.props.redlining.measurements) {
            const settings = {
                displayCrs: this.props.displayCrs,
                lenUnit: this.props.redlining.lenUnit,
                areaUnit: this.props.redlining.areaUnit
            };
            MeasureUtils.updateFeatureMeasurements(feature, feature.get('shape'), this.props.mapCrs, settings);
        } else if (hadMeasurements) {
            feature.set('measurements', undefined);
            feature.set('segment_labels', undefined);
            feature.set('label', '');
        }
    };
    waitForFeatureAndLayer = (layerId, featureId, callback) => {
        const redliningLayer = this.searchRedliningLayer(layerId);
        if (!redliningLayer) {
            OlLayerAdded.connect((layer) => {
                if (layer.get("id") === layerId) {
                    const feature = featureId ? layer.getSource().getFeatureById(featureId) : null;
                    callback(layer, feature);
                    return true;
                }
                return false;
            });
        } else if (featureId) {
            const feature = redliningLayer.getSource().getFeatureById(featureId);
            if (feature) {
                callback(redliningLayer, feature);
            } else {
                OlLayerUpdated.connect((layer) => {
                    if (layer.get("id") === layerId) {
                        const feat = layer.getSource().getFeatureById(featureId);
                        if (feat) {
                            callback(layer, feat);
                            return true;
                        }
                    }
                    return false;
                });
            }
        } else {
            callback(redliningLayer, null);
        }
    };
    enterTemporaryEditMode = (featureId, layerId, editTool) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.setCurrentFeature(feature);
            if (editTool === 'Transform') {
                this.setupTransformInteraction([this.currentFeature]);
            } else {
                this.setupModifyInteraction([this.currentFeature]);
            }
            this.picking = true;
        });
    };
    leaveTemporaryEditMode = () => {
        if (this.currentFeature) {
            this.commitCurrentFeature(this.props.redlining);
        }
        if (this.picking) {
            // Remove modify interactions
            this.props.map.removeInteraction(this.interactions.pop());
            this.picking = false;
        }
    };
    addPickInteraction = () => {
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (!redliningLayer) {
            return;
        }

        const selectInteraction = new ol.interaction.Select({layers: [redliningLayer], hitTolerance: 5});
        let currentEditInteraction = null;
        selectInteraction.on('select', (evt) => {
            if (evt.selected.length === 1 && evt.selected[0] === this.currentFeature) {
                return;
            }
            if (this.currentFeature) {
                this.commitCurrentFeature(this.props.redlining);
            }
            if (currentEditInteraction) {
                this.props.map.removeInteraction(currentEditInteraction);
                this.interactions = this.interactions.filter(i => i !== currentEditInteraction);
                currentEditInteraction = null;
            }
            if (evt.selected.length === 1) {
                this.setCurrentFeature(evt.selected[0]);
                const geomTypeConfig = GeomTypeConfig[this.currentFeature.get('shape')];
                if (geomTypeConfig && geomTypeConfig.editTool === 'Transform') {
                    currentEditInteraction = this.setupTransformInteraction([this.currentFeature]);
                    currentEditInteraction.on('select', (ev) => {
                        // Clear selection when selecting a different feature, and let the parent select interaction deal with the new feature
                        if (this.currentFeature && ev.feature !== this.currentFeature) {
                            this.commitCurrentFeature(this.props.redlining);
                            currentEditInteraction.setSelection(new ol.Collection());
                        }
                    });
                } else {
                    currentEditInteraction = this.setupModifyInteraction(selectInteraction.getFeatures().getArray());
                }
            }
        }, this);
        if (this.props.redlining.action === 'PickDraw') {
            this.props.map.on('click', this.maybeEnterTemporaryDrawMode);
        }
        this.props.map.addInteraction(selectInteraction);
        this.interactions.push(selectInteraction);
        this.picking = true;
    };
    addTransformInteraction = () => {
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (!redliningLayer) {
            return;
        }
        const transformInteraction = this.setupTransformInteraction();
        transformInteraction.on('select', (evt) => {
            if (evt.feature === this.currentFeature) {
                return;
            }
            if (this.currentFeature) {
                this.commitCurrentFeature(this.props.redlining);
            }
            if (evt.feature) {
                this.setCurrentFeature(evt.feature);
            }
        });
        this.picking = true;
    };
    addPickDrawInteraction = () => {
        this.waitForFeatureAndLayer(this.props.redlining.layer, null, () => this.addPickInteraction());
    };
    maybeEnterTemporaryDrawMode = (ev) => {
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (this.currentFeature || (!this.props.redlining.drawMultiple && redliningLayer.getSource().getFeatures().length > 0)) {
            return;
        }
        let featureHit = false;
        this.props.map.forEachFeatureAtPixel(ev.pixel, (feature, layer) => {
            featureHit |= (layer === redliningLayer);
        }, {hitTolerance: 5});
        if (!redliningLayer || featureHit) {
            return;
        }
        this.reset(this.props.redlining);
        this.props.map.un('click', this.maybeEnterTemporaryDrawMode);

        const geomTypeConfig = GeomTypeConfig[this.props.redlining.geomType];
        if (!geomTypeConfig) {
            return;
        }
        const isFreeHand = this.props.redlining.freehand;
        const drawInteraction = geomTypeConfig.drawInteraction({
            stopClick: true,
            condition: (event) => { return event.originalEvent.buttons === 1; },
            style: () => { return this.picking ? [] : FeatureStyles.sketchInteraction(); },
            freehand: isFreeHand
        });
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuidv4());
            this.currentFeature.set('shape', this.props.redlining.geomType);
            this.currentFeature.setStyle(this.styleFunction);
            this.updateFeatureStyle(this.props.redlining.style);
            this.currentFeature.on('change', this.updateMeasurements);
        }, this);
        drawInteraction.on('drawend', () => {
            // Draw end
            this.commitCurrentFeature(this.props.redlining, true);
            this.reset(this.props.redlining);
            // Ughh... Apparently we need to wait 250ms for the 'singleclick' event processing to finish to avoid pick interactions picking up the current event
            setTimeout(() => this.addPickInteraction(true), 300);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions.push(drawInteraction);
        this.picking = false;

        const clickCoord = MapUtils.getHook(MapUtils.GET_SNAPPED_COORDINATES_FROM_PIXEL_HOOK)(ev.pixel);
        drawInteraction.appendCoordinates([clickCoord]);
        if (this.props.redlining.geomType === 'Point') {
            drawInteraction.finishDrawing();
        }
    };
    setupModifyInteraction = (selectedFeatures = []) => {
        const modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection(selectedFeatures),
            condition: (event) => { return event.originalEvent.buttons === 1; },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                if (event.type === "pointerdown" && ol.events.condition.shiftKeyOnly(event)) {
                    this.props.map.setIgnoreNextClick(true);
                }
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            }
        });
        modifyInteraction.on('modifyend', this.updateSelectedFeature);
        this.props.map.addInteraction(modifyInteraction);
        this.interactions.push(modifyInteraction);
        return modifyInteraction;
    };
    setupTransformInteraction = (selectedFeatures = []) => {
        const transformInteraction = new ol.interaction.Transform({
            stretch: false,
            keepAspectRatio: (ev) => {
                return this.currentFeature ? GeomTypeConfig[this.currentFeature.get('shape')].regular || ol.events.condition.shiftKeyOnly(ev) : false;
            }
        });
        transformInteraction.on('rotating', (e) => {
            if (this.currentFeature.get('shape') === 'Text') {
                this.currentFeature.set('rotation', -e.angle);
            }
        });
        transformInteraction.on('rotateend', this.updateSelectedFeature);
        transformInteraction.on('translateend', this.updateSelectedFeature);
        transformInteraction.on('scaleend', this.updateSelectedFeature);
        this.props.map.addInteraction(transformInteraction);
        this.interactions.push(transformInteraction);
        transformInteraction.setSelection(new ol.Collection(selectedFeatures));
        return transformInteraction;
    };
    updateSelectedFeature = () => {
        const featureObj = this.currentFeatureObject();
        this.props.changeRedliningState({selectedFeature: featureObj, geomType: featureObj?.shape ?? this.props.redlining.geomType});
    };
    triggerDelete = () => {
        this.props.changeRedliningState({action: "Delete"});
    };
    deleteCurrentFeature = () => {
        if (this.currentFeature) {
            this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()], true);
            this.currentFeature = null;
        }
    };
    commitCurrentFeature = (redliningProps, newFeature = false) => {
        const feature = this.currentFeatureObject();
        if (!feature) {
            return;
        }
        // Don't commit empty/invalid features
        if (
            (feature.shape === "Text" && !feature.properties.label) ||
            (feature.shape === "Circle" && feature.circleParams.radius === 0) ||
            (feature.geometry?.type === "Polygon" && this.currentFeature.getGeometry().getArea() === 0)
        ) {
            if (!newFeature) {
                this.props.removeLayerFeatures(redliningProps.layer, [feature.id]);
            }
            this.resetSelectedFeature();
            return;
        }
        if (feature.shape === "Circle") {
            const {center, radius} = feature.circleParams;
            const deg2rad = Math.PI / 180;
            feature.geometry.type = "Polygon";
            feature.geometry.coordinates = [
                Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))
            ];
        }
        if (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") {
            feature.geometry.coordinates = VectorLayerUtils.removeDuplicateNodes(feature.geometry.coordinates);
        }
        const layer = {
            id: redliningProps.layer,
            title: redliningProps.layerTitle,
            role: LayerRole.USERLAYER
        };
        this.props.addLayerFeatures(layer, [feature]);
        this.resetSelectedFeature();
    };
    resetSelectedFeature = () => {
        if (this.currentFeature) {
            // Reset selection style
            const styleName = this.currentFeature.get("shape") === "Text" ? "text" : "default";
            const style = FeatureStyles[styleName](this.currentFeature, this.currentFeature.get('styleOptions'));
            this.currentFeature.setStyle(style);
            this.currentFeature.un('change', this.updateMeasurements);
            this.currentFeature = null;
            this.props.changeRedliningState({selectedFeature: null});
        }
    };
    reset = (redliningProps) => {
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if (this.picking) {
            this.commitCurrentFeature(redliningProps, false);
        } else {
            this.resetSelectedFeature();
        }
        this.props.map.un('click', this.maybeEnterTemporaryDrawMode);
        this.picking = false;
    };
    searchRedliningLayer = (layerId) => {
        return this.props.map.getLayers().getArray().find(l => l.get('id') === layerId) ?? null;
    };
    currentFeatureObject = () => {
        if (!this.currentFeature) {
            return null;
        }
        const format = new ol.format.GeoJSON();
        const feature = format.writeFeatureObject(this.currentFeature);
        if (this.currentFeature.get("shape") === "Circle") {
            feature.circleParams = {
                center: this.currentFeature.getGeometry().getCenter(),
                radius: this.currentFeature.getGeometry().getRadius()
            };
        }
        feature.styleName = this.currentFeature.get('styleName');
        feature.styleOptions = this.currentFeature.get('styleOptions');
        feature.shape = this.currentFeature.get('shape');
        feature.measurements = this.currentFeature.get('measurements');
        feature.crs = this.props.mapCrs;
        // Don't pollute GeoJSON object properties with internal props
        delete feature.properties.styleName;
        delete feature.properties.styleOptions;
        delete feature.properties.shape;
        delete feature.properties.measurements;
        delete feature.properties.circleParams;
        // Don't store empty label prop
        if (feature.properties.label === "") {
            delete feature.properties.label;
        }
        return feature;
    };
}


export default connect((state) => ({
    displayCrs: state.map.displayCrs,
    mapCrs: state.map.projection,
    redlining: state.redlining
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

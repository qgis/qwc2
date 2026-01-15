/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import Mousetrap from 'mousetrap';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayerFeatures} from '../../actions/layers';
import {changeRedliningState} from '../../actions/redlining';
import FeatureAttributesWindow from '../../components/FeatureAttributesWindow';
import LocationRecorder from '../../components/LocationRecorder';
import {OlLayerAdded, OlLayerUpdated} from '../../components/map/OlLayer';
import NumericInputWindow from '../../components/NumericInputWindow';
import FeatureStyles from '../../utils/FeatureStyles';
import MapUtils from '../../utils/MapUtils';
import MeasureUtils from '../../utils/MeasureUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';

const GeomTypeConfig = {
    Text: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Point"}), editTool: 'Pick', drawNodes: true},
    Point: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "Point"}), editTool: 'Pick', drawNodes: true, showRecordLocation: true},
    LineString: {drawInteraction: (opts) => new ol.interaction.Draw({...opts, type: "LineString"}), editTool: 'Pick', drawNodes: true, showRecordLocation: true},
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
        layers: PropTypes.array,
        map: PropTypes.object,
        mapCrs: PropTypes.string,
        redlining: PropTypes.object,
        removeLayerFeatures: PropTypes.func
    };
    static defaultProps = {
        redlining: {}
    };
    state = {
        showRecordLocation: false
    };
    constructor(props) {
        super(props);

        this.interactions = [];
        this.picking = false;
        this.selectedFeatures = [];
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
            this.deleteCurrentFeatures();
            this.props.changeRedliningState({...prevProps.redlining, selectedFeature: null});
            return;
        }
        if (this.props.redlining.action === 'Clone') {
            this.cloneCurrentFeatures();
            this.props.changeRedliningState({...prevProps.redlining, selectedFeature: null});
            return;
        }
        if (this.props.redlining.action === 'Export') {
            this.export();
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
                this.waitForFeatureAndLayer(this.props.redlining.layer, null, () => this.addPickInteraction());
            }
        }
        if (this.selectedFeatures) {
            // Update feature style
            if (this.props.redlining.style !== prevProps.redlining.style) {
                this.selectedFeatures.forEach(this.updateFeatureStyle);
            }
            // Update current feature measurements
            if (this.props.redlining.showmeasurements !== prevProps.redlining.showmeasurements) {
                this.selectedFeatures.forEach(this.toggleFeatureMeasurements);
            } else if (
                this.props.map.displayCrs !== prevProps.map.displayCrs ||
                this.props.redlining.lenUnit !== prevProps.redlining.lenUnit ||
                this.props.redlining.areaUnit !== prevProps.redlining.areaUnit
            ) {
                this.selectedFeatures.forEach(feature => feature.changed());
            }
        }
    }
    render() {
        const widgets = [];
        if (this.props.redlining.extraAction === "NumericInput") {
            widgets.push(
                <NumericInputWindow
                    feature={this.props.redlining.selectedFeature}
                    key="NumericInputWindow"
                    onClose={() => this.props.changeRedliningState({extraAction: null})}
                    onFeatureChanged={this.updateCurrentFeature} />
            );
        } else if (this.props.redlining.extraAction === "FeatureAttributes") {
            widgets.push(
                <FeatureAttributesWindow
                    feature={this.props.redlining.selectedFeature}
                    key="FeatureAttributesWindow" layerid={this.props.redlining.layer}
                    onClose={() => this.props.changeRedliningState({extraAction: null})}
                    onFeatureChanged={this.updateCurrentFeature} />
            );
        }
        if (this.state.showRecordLocation) {
            const drawInteraction = this.interactions.find(interaction => (interaction instanceof ol.interaction.Draw));
            widgets.push(
                <LocationRecorder
                    drawInteraction={drawInteraction} geomType={this.props.redlining.geomType} key="LocationRecorder" map={this.props.map} />
            );
        }
        return widgets;
    }
    updateCurrentFeature = (feature, deletedKeys = []) => {
        if (this.selectedFeatures.length === 1 && this.props.redlining.selectedFeature) {
            if (feature.circleParams) {
                const circleParams = feature.circleParams;
                this.selectedFeatures[0].setGeometry(new ol.geom.Circle(circleParams.center, circleParams.radius));
            } else {
                this.selectedFeatures[0].getGeometry().setCoordinates(feature.geometry.coordinates);
            }
            this.selectedFeatures[0].setProperties(feature.properties, true);
            deletedKeys.forEach(key => {
                this.selectedFeatures[0].unset(key);
            });
            this.props.changeRedliningState({selectedFeature: feature, geomType: feature.shape});
        }
    };
    styleOptions = (styleProps, isText) => {
        return {
            strokeColor: isText ? styleProps.textOutlineColor : styleProps.borderColor,
            strokeWidth: 1 + 0.5 * styleProps.size,
            strokeDash: styleProps.strokeDash,
            fillColor: isText ? styleProps.textFillColor : styleProps.fillColor,
            circleRadius: 5 + styleProps.size,
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
            strokeDash: styleOptions.strokeDash,
            size: (styleOptions.strokeWidth - 1) * 2,
            [isText ? "textFillColor" : "fillColor"]: styleOptions.fillColor,
            text: label,
            headmarker: styleOptions.headmarker,
            tailmarker: styleOptions.tailmarker
        };
    };
    updateFeatureStyle = (feature) => {
        this.blockOnChange = true;
        const styleProps = this.props.redlining.style;
        const isText = feature.get("shape") === "Text";
        const styleName = isText ? "text" : "default";
        const opts = this.styleOptions(styleProps, isText);
        if (!feature.get('measurements') && this.selectedFeatures.length <= 1 && !(isText && !styleProps.text)) {
            feature.set('label', styleProps.text);
        }
        feature.set('styleName', styleName);
        feature.set('styleOptions', opts);
        this.blockOnChange = false;
    };
    toggleFeatureMeasurements = (feature) => {
        if (this.props.redlining.showmeasurements) {
            const settings = {
                displayCrs: this.props.displayCrs,
                lenUnit: this.props.redlining.lenUnit,
                areaUnit: this.props.redlining.areaUnit
            };
            MeasureUtils.updateFeatureMeasurements(feature, feature.get('shape'), this.props.mapCrs, settings);
        } else if (feature.get('measurements')) {
            feature.set('measurements', undefined);
            feature.set('segment_labels', undefined);
            feature.set('label', '');
        }
    };
    updateMeasurements = (ev) => {
        if (this.blockOnChange) {
            return;
        }
        const feature = ev.target;
        if (feature.get('measurements')) {
            const settings = {
                displayCrs: this.props.displayCrs,
                lenUnit: this.props.redlining.lenUnit,
                areaUnit: this.props.redlining.areaUnit
            };
            MeasureUtils.updateFeatureMeasurements(feature, feature.get('shape'), this.props.mapCrs, settings);
        }
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
    searchRedliningLayer = (layerId) => {
        return this.props.map.getLayers().getArray().find(l => l.get('id') === layerId) ?? null;
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
        drawInteraction.on('drawstart', (ev) => {
            if (this.picking && this.props.redlining.drawMultiple === false) {
                return;
            }
            this.leaveTemporaryEditMode();
            ev.feature.setId(uuidv4());
            ev.feature.set('shape', this.props.redlining.geomType);
            this.updateFeatureStyle(ev.feature);
            this.toggleFeatureMeasurements(ev.feature);
            this.selectFeatures([ev.feature], false);
        }, this);
        drawInteraction.on('drawend', (ev) => {
            this.commitFeatures([ev.feature], this.props.redlining, true);
            this.enterTemporaryEditMode(ev.feature.getId(), this.props.redlining.layer, geomTypeConfig.editTool);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions.push(drawInteraction);
        this.setState({showRecordLocation: geomTypeConfig.showRecordLocation});
    };
    enterTemporaryEditMode = (featureId, layerId, editTool) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.selectFeatures([feature]);
            if (editTool === 'Transform') {
                this.setupTransformInteraction(redliningLayer, this.selectedFeatures);
            } else {
                this.setupModifyInteraction(this.selectedFeatures);
            }
            this.picking = true;
        });
    };
    leaveTemporaryEditMode = () => {
        this.commitFeatures(this.selectedFeatures, this.props.redlining);
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
            if (evt.selected.length === 1 && this.selectedFeatures.includes(evt.selected[0])) {
                return;
            }
            this.commitFeatures(this.selectedFeatures, this.props.redlining);
            if (currentEditInteraction) {
                this.props.map.removeInteraction(currentEditInteraction);
                this.interactions = this.interactions.filter(i => i !== currentEditInteraction);
                currentEditInteraction = null;
            }
            if (evt.selected.length === 1) {
                this.selectFeatures(evt.selected);
                const geomTypeConfig = GeomTypeConfig[evt.selected[0].get('shape')];
                if (geomTypeConfig && geomTypeConfig.editTool === 'Transform') {
                    currentEditInteraction = this.setupTransformInteraction(redliningLayer, [evt.selected[0]]);
                    currentEditInteraction.on('select', (ev) => {
                        // Clear selection when selecting a different feature, and let the parent select interaction deal with the new feature
                        if (!isEmpty(this.selectedFeatures) && !this.selectedFeatures.includes(ev.feature)) {
                            this.commitFeatures(this.selectedFeatures, this.props.redlining);
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
            return null;
        }
        const transformInteraction = this.setupTransformInteraction(redliningLayer, [], true);
        transformInteraction.on('select', (evt) => {
            const added = evt.features.getArray().filter(x => !this.selectedFeatures.includes(x));
            const removed = this.selectedFeatures.filter(x => !evt.features.getArray().includes(x));
            this.selectFeatures(added);
            this.commitFeatures(removed, this.props.redlining);
        });
        this.picking = true;
        return transformInteraction;
    };
    maybeEnterTemporaryDrawMode = (ev) => {
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (this.selectedFeatures.length || (!this.props.redlining.drawMultiple && redliningLayer.getSource().getFeatures().length > 0)) {
            return;
        }
        const featureHit = this.props.map.hasFeatureAtPixel(ev.pixel, {hitTolerance: 5, layerFilter: layer => layer === redliningLayer});
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
            evt.feature.setId(uuidv4());
            evt.feature.set('shape', this.props.redlining.geomType);
            this.updateFeatureStyle(evt.feature);
            this.toggleFeatureMeasurements(evt.feature);
            this.selectFeatures([evt.feature], false);
        }, this);
        drawInteraction.on('drawend', () => {
            // Draw end
            this.commitFeatures(this.selectedFeatures, this.props.redlining, true);
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
    setupTransformInteraction = (redliningLayer, selectedFeatures = [], multi = false) => {
        const transformInteraction = new ol.interaction.Transform({
            stretch: false,
            addCondition: multi ? ((ev) => ev.originalEvent.ctrlKey) : null,
            keepAspectRatio: (ev) => {
                return this.selectedFeatures.find(f => GeomTypeConfig[f.get('shape')].regular) || ol.events.condition.shiftKeyOnly(ev);
            },
            layers: [redliningLayer],
            translateFeature: true
        });
        // Hacky workaround translateFeature interfering with ctrl-click to deselect selected features
        const origHandleDownEvent = transformInteraction.handleDownEvent;
        transformInteraction.handleDownEvent = (evt) => {
            if (evt.originalEvent.ctrlKey) {
                transformInteraction.set('translateFeature', false);
            }
            const ret = origHandleDownEvent.call(transformInteraction, evt);
            transformInteraction.set('translateFeature', true);
            return ret;
        };
        transformInteraction.on('rotating', (ev) => {
            ev.features.forEach(feature => {
                if (feature.get('shape') === 'Text') {
                    feature.set('rotation', -ev.angle);
                }
            });
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
        let featureObj = null;
        if (this.selectedFeatures.length === 1) {
            featureObj = this.serializeFeature(this.selectedFeatures[0]);
        } else if (this.selectedFeatures.length > 1) {
            featureObj = {type: "FeatureCollection", features: []};
        }
        this.props.changeRedliningState({selectedFeature: featureObj, geomType: featureObj?.shape ?? this.props.redlining.geomType});
    };
    triggerDelete = () => {
        this.props.changeRedliningState({action: "Delete"});
    };
    deleteCurrentFeatures = () => {
        if (this.selectedFeatures.length) {
            this.props.removeLayerFeatures(this.props.redlining.layer, this.selectedFeatures.map(f => f.getId()), true);
            this.selectedFeatures = [];
        }
    };
    cloneCurrentFeatures = () => {
        if (isEmpty(this.selectedFeatures)) {
            return;
        }
        const shiftCoordinates = (coords) => {
            if (typeof coords[0] === 'number') {
                coords[0] += 10;
                coords[1] += 10;
            } else {
                coords.map(shiftCoordinates);
            }
        };
        const cloneIds = [];
        const newFeatureObjs = this.selectedFeatures.map(feature => {
            this.deselectFeature(feature, false);
            const featureObj = this.serializeFeature(feature);
            featureObj.id = uuidv4();
            shiftCoordinates(featureObj.geometry.coordinates);
            cloneIds.push(featureObj.id);
            return featureObj;
        });
        const layer = {
            id: this.props.redlining.layer,
            title: this.props.redlining.layerTitle,
            role: LayerRole.USERLAYER
        };
        this.props.addLayerFeatures(layer, newFeatureObjs);
        this.waitForFeatureAndLayer(this.props.redlining.layer, cloneIds[0], (l) => {
            const features = cloneIds.map(id => l.getSource().getFeatureById(id));
            this.selectFeatures(features, false);
            while (this.interactions.length > 0) {
                this.props.map.removeInteraction(this.interactions.shift());
            }
            this.addTransformInteraction().setSelection(new ol.Collection(features));
        });
    };
    updateRedliningState = (firstSelection) => {
        if (this.selectedFeatures.length > 0) {
            const features = this.selectedFeatures;
            const featureObj = features.length === 1 ? this.serializeFeature(features[0]) : {type: "FeatureCollection", features: []};
            const newRedliningState = {
                selectedFeature: featureObj
            };
            if (firstSelection || this.selectedFeatures.length === 1) {
                newRedliningState.style = this.styleProps(features[0]);
                newRedliningState.measurements = !!features[0].get('measurements');
                newRedliningState.geomType = featureObj?.shape ?? this.props.redlining.geomType;
                const measurements = features[0].get('measurements');
                if (measurements) {
                    newRedliningState.lenUnit = measurements.lenUnit;
                    newRedliningState.areaUnit = measurements.areaUnit;
                }
            }
            this.props.changeRedliningState(newRedliningState);
        } else {
            this.props.changeRedliningState({selectedFeature: null});
        }
    };
    selectFeatures = (features, updateState = true) => {
        const firstSelection = isEmpty(this.selectedFeatures);
        features.forEach(feature => {
            feature.setStyle(this.styleFunction);
            feature.on('change', this.updateMeasurements);
            this.selectedFeatures.push(feature);
        });
        if (updateState) {
            this.updateRedliningState(firstSelection);
        }
    };
    deselectFeature = (feature, updateState) => {
        const styleName = feature.get("shape") === "Text" ? "text" : "default";
        const style = FeatureStyles[styleName](feature, feature.get('styleOptions'));
        feature.setStyle(style);
        feature.un('change', this.updateMeasurements);
        this.selectedFeatures = this.selectedFeatures.filter(f => f !== feature);
        if (updateState) {
            this.updateRedliningState(false);
        }
    };
    commitFeatures = (features, redliningProps, newFeature = false) => {
        const featureObjects = features.map(feature => {
            this.deselectFeature(feature, false);
            const featureObj = this.serializeFeature(feature);
            // Don't commit empty/invalid features
            if (
                (featureObj.shape === "Text" && !featureObj.properties.label) ||
                (featureObj.shape === "Circle" && featureObj.circleParams.radius === 0) ||
                (featureObj.geometry?.type === "Polygon" && feature.getGeometry().getArea() === 0)
            ) {
                if (!newFeature) {
                    this.props.removeLayerFeatures(redliningProps.layer, [featureObj.id]);
                }
                return null;
            }
            if (featureObj.shape === "Circle") {
                const {center, radius} = featureObj.circleParams;
                const deg2rad = Math.PI / 180;
                featureObj.geometry.type = "Polygon";
                featureObj.geometry.coordinates = [
                    Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))
                ];
            }
            if (featureObj.geometry.type === "LineString" || featureObj.geometry.type === "Polygon") {
                featureObj.geometry.coordinates = VectorLayerUtils.removeDuplicateNodes(featureObj.geometry.coordinates);
            }
            return featureObj;
        }).filter(Boolean);
        if (isEmpty(featureObjects)) {
            return [];
        }
        const layer = {
            id: redliningProps.layer,
            title: redliningProps.layerTitle,
            role: LayerRole.USERLAYER
        };
        this.props.addLayerFeatures(layer, featureObjects);
        this.updateRedliningState();
        return featureObjects;
    };
    reset = (redliningProps) => {
        this.setState({showRecordLocation: false});
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if (this.picking) {
            this.commitFeatures(this.selectedFeatures, redliningProps, false);
        } else {
            this.selectedFeatures.forEach(feature => {
                this.deselectFeature(feature, false);
            });
            this.updateRedliningState(false);
        }
        this.props.map.un('click', this.maybeEnterTemporaryDrawMode);
        this.picking = false;
    };
    serializeFeature = (feature) => {
        const format = new ol.format.GeoJSON();
        const featureObject = format.writeFeatureObject(feature);
        if (feature.get("shape") === "Circle") {
            featureObject.circleParams = {
                center: feature.getGeometry().getCenter(),
                radius: feature.getGeometry().getRadius()
            };
        }
        featureObject.styleName = feature.get('styleName');
        featureObject.styleOptions = feature.get('styleOptions');
        featureObject.shape = feature.get('shape');
        featureObject.measurements = feature.get('measurements');
        featureObject.crs = this.props.mapCrs;
        // Don't pollute GeoJSON object properties with internal props
        delete featureObject.properties.styleName;
        delete featureObject.properties.styleOptions;
        delete featureObject.properties.shape;
        delete featureObject.properties.measurements;
        delete featureObject.properties.circleParams;
        // Don't store empty label prop
        if (featureObject.properties.label === "") {
            delete featureObject.properties.label;
        }
        return featureObject;
    };
    export = () => {
        const committedFeatures = this.commitFeatures(this.selectedFeatures, this.props.redlining);
        const layer = this.props.layers.find(l => l.id === this.props.redlining.layer);
        if (!layer) {
            return;
        }
        if (this.props.redlining.format === "geojson") {
            const geojson = JSON.stringify({
                type: "FeatureCollection",
                features: layer.features.map(feature => {
                    const newFeature = {...(committedFeatures.find(f => f.id === feature.id) ?? feature)};
                    newFeature.geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || this.props.mapCrs, 'EPSG:4326');
                    delete newFeature.crs;
                    return newFeature;
                })
            }, null, ' ');
            FileSaver.saveAs(new Blob([geojson], {type: "text/plain;charset=utf-8"}), layer.title + ".json");
        } else if (this.props.redlining.format === "kml") {
            const nativeLayer = this.searchRedliningLayer(this.props.redlining.layer);
            if (!nativeLayer) {
                return;
            }
            const kmlFormat = new ol.format.KML();
            const features = nativeLayer.getSource().getFeatures().map(feature => {
                // Circle is not supported by kml format
                if (feature.getGeometry() instanceof ol.geom.Circle) {
                    feature = feature.clone();
                    feature.setGeometry(ol.geom.polygonFromCircle(feature.getGeometry()));
                }
                return feature;
            });
            const data = kmlFormat.writeFeatures(features, {featureProjection: this.props.mapCrs});
            FileSaver.saveAs(new Blob([data], {type: "application/vnd.google-earth.kml+xml"}), layer.title + ".kml");
        }
    };
}


export default connect((state) => ({
    displayCrs: state.map.displayCrs,
    mapCrs: state.map.projection,
    redlining: state.redlining,
    layers: state.layers.flat
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

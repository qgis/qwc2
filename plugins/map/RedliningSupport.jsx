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
import {createSelector} from 'reselect';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayerFeatures} from '../../actions/layers';
import {changeRedliningState} from '../../actions/redlining';
import NumericInputWindow from '../../components/NumericInputWindow';
import {OlLayerAdded, OlLayerUpdated} from '../../components/map/OlLayer';
import displayCrsSelector from '../../selectors/displaycrs';
import FeatureStyles from '../../utils/FeatureStyles';
import MapUtils from '../../utils/MapUtils';
import MeasureUtils from '../../utils/MeasureUtils';

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
                scale: opts.strokeWidth,
                fill: new ol.style.Fill({color: opts.fillColor}),
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
        const layerChanged = this.props.redlining.layer !== prevProps.redlining.layer;
        if (this.props.redlining === prevProps.redlining) {
            // pass
        } else if (!this.props.redlining || !this.props.redlining.action) {
            this.reset(layerChanged);
        } else if (this.props.redlining.action === 'Commit') {
            if (this.props.redlining.style !== prevProps.redlining.style) {
                this.updateFeatureStyle(this.props.redlining.style);
            }
            this.commitCurrentFeature();
            this.props.changeRedliningState({...prevProps.redlining, action: 'Pick', selectedFeature: null});
        } else if ((this.props.redlining.action === 'Pick' || this.props.redlining.action === 'Buffer') && (prevProps.redlining.action !== this.props.redlining.action || layerChanged || (!this.props.redlining.selectedFeature && prevProps.redlining.selectedFeature))) {
            this.addPickInteraction(layerChanged);
        } else if (this.props.redlining.action === 'PickDraw' && (prevProps.redlining.action !== 'PickDraw' || this.props.redlining.geomType !== prevProps.redlining.geomType)) {
            this.addPickDrawInteraction(true);
        } else if (this.props.redlining.action === 'Transform' && prevProps.redlining.action !== 'Transform') {
            this.addTransformInteraction(layerChanged);
        } else if (this.props.redlining.action === 'Delete') {
            this.deleteCurrentFeature(prevProps);
        } else if (this.props.redlining.action === 'Draw' && (prevProps.redlining.action !== 'Draw' || this.props.redlining.geomType !== prevProps.redlining.geomType || layerChanged)) {
            this.addDrawInteraction(layerChanged);
        } else if (this.props.redlining.freehand !== prevProps.redlining.freehand) {
            this.addDrawInteraction(layerChanged);
        } else if (this.props.redlining.style !== prevProps.redlining.style) {
            this.updateFeatureStyle(this.props.redlining.style);
        }
        if (this.currentFeature && (
            this.props.displayCrs !== prevProps.displayCrs ||
            this.props.redlining.measurements !== prevProps.redlining.measurements ||
            this.props.redlining.lenUnit !== prevProps.redlining.lenUnit ||
            this.props.redlining.areaUnit !== prevProps.redlining.areaUnit
        )) {
            this.currentFeature.changed();
        }
    }
    render() {
        if (this.props.redlining.numericInput) {
            return (
                <NumericInputWindow feature={this.props.redlining.selectedFeature} onClose={this.closeNumericInput} onFeatureChanged={this.updateCurrentFeature} />
            );
        }
        return null;
    }
    closeNumericInput = () => {
        this.props.changeRedliningState({numericInput: false});
    };
    updateCurrentFeature = (feature) => {
        if (this.currentFeature && this.props.redlining.selectedFeature) {
            if (feature.circleParams) {
                const circleParams = feature.circleParams;
                this.currentFeature.setGeometry(new ol.geom.Circle(circleParams.center, circleParams.radius));
            } else {
                this.currentFeature.getGeometry().setCoordinates(feature.geometry.coordinates);
            }
            this.props.changeRedliningState({selectedFeature: feature});
        }
    };
    styleOptions = (styleProps) => {
        return {
            strokeColor: styleProps.borderColor,
            strokeWidth: 1 + 0.5 * styleProps.size,
            fillColor: styleProps.fillColor,
            circleRadius: 5 + styleProps.size,
            strokeDash: [],
            headmarker: styleProps.headmarker,
            tailmarker: styleProps.tailmarker
        };
    };
    styleProps = (feature) => {
        const styleOptions = feature.get('styleOptions');
        const label = feature.get("label") || "";
        return {
            borderColor: styleOptions.strokeColor,
            size: (styleOptions.strokeWidth - 1) * 2,
            fillColor: styleOptions.fillColor,
            text: label,
            headmarker: styleOptions.headmarker,
            tailmarker: styleOptions.tailmarker
        };
    };
    updateFeatureStyle = (styleProps) => {
        if (this.currentFeature) {
            const styleName = this.currentFeature.get("shape") === "Text" ? "text" : "default";
            const opts = this.styleOptions(styleProps);
            this.blockOnChange = true;
            this.currentFeature.set('label', styleProps.text);
            this.currentFeature.set('styleName', styleName);
            this.currentFeature.set('styleOptions', opts);
            this.blockOnChange = false;
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
    setCurrentFeature = (feature) => {
        this.currentFeature = feature;
        this.currentFeature.setStyle(this.styleFunction);
        const circleParams = this.currentFeature.get('circleParams');
        if (circleParams) {
            this.currentFeature.setGeometry(new ol.geom.Circle(circleParams.center, circleParams.radius));
        }
        const measurements = this.currentFeature.get('measurements');
        const newRedliningState = {
            geomType: this.currentFeature.get('shape'),
            style: this.styleProps(this.currentFeature),
            measurements: !!this.currentFeature.get('measurements'),
            selectedFeature: this.currentFeatureObject()
        };
        if (measurements) {
            newRedliningState.lenUnit = measurements.lenUnit;
            newRedliningState.areaUnit = measurements.areaUnit;
        }
        this.props.changeRedliningState(newRedliningState);

        this.currentFeature.on('change', this.updateMeasurements);
    };
    addDrawInteraction = (layerChanged) => {
        this.reset(layerChanged);
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
            this.commitCurrentFeature(true);
            if (geomTypeConfig.editTool === 'Transform') {
                this.enterTemporaryTransformMode(featureId, this.props.redlining.layer);
            } else {
                this.enterTemporaryPickMode(featureId, this.props.redlining.layer);
            }
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
                mapCrs: this.props.mapCrs,
                displayCrs: this.props.displayCrs,
                lenUnit: this.props.redlining.lenUnit,
                areaUnit: this.props.redlining.areaUnit,
                decimals: 2
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
    enterTemporaryPickMode = (featureId, layerId) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.setCurrentFeature(feature);
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
                },
                style: FeatureStyles.sketchInteraction()
            });
            modifyInteraction.on('modifyend', () => {
                this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
            });
            this.props.map.addInteraction(modifyInteraction);
            this.interactions.push(modifyInteraction);
            this.picking = true;
        });
    };
    enterTemporaryTransformMode = (featureId, layerId) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.setCurrentFeature(feature);
            const transformInteraction = new ol.interaction.Transform({
                stretch: false,
                keepAspectRatio: () => {
                    return this.currentFeature ? GeomTypeConfig[this.currentFeature.get('shape')].regular : false;
                }
            });
            this.props.map.addInteraction(transformInteraction);
            transformInteraction.select(this.currentFeature, true);
            transformInteraction.on('rotateend', () => {
                this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
            });
            transformInteraction.on('translateend', () => {
                this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
            });
            transformInteraction.on('scaleend', () => {
                this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
            });
            this.interactions.push(transformInteraction);
            this.picking = true;
        });
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
        this.reset(false);
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
            this.commitCurrentFeature(true);
            this.props.map.removeInteraction(drawInteraction);
            // Ughh... Apparently we need to wait 250ms for the 'singleclick' event processing to finish to avoid pick interactions picking up the current event
            setTimeout(() => this.addPickInteraction(true), 300);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions.push(drawInteraction);
        this.picking = false;

        const clickCoord = MapUtils.getHook(MapUtils.GET_COORDINATES_FROM_PIXEL_HOOK)(ev.pixel);
        drawInteraction.appendCoordinates([clickCoord]);
        if (this.props.redlining.geomType === 'Point') {
            drawInteraction.finishDrawing();
        }
    };
    leaveTemporaryEditMode = () => {
        if (this.currentFeature) {
            this.commitCurrentFeature();
        }
        if (this.picking) {
            // Remove modify interactions
            this.props.map.removeInteraction(this.interactions.pop());
            this.picking = false;
        }
    };
    addPickDrawInteraction = (layerChanged) => {
        this.waitForFeatureAndLayer(this.props.redlining.layer, null, () => this.addPickInteraction(layerChanged));
    };
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
        const transformInteraction = new ol.interaction.Transform({
            keepAspectRatio: () => {
                return this.currentFeature ? GeomTypeConfig[this.currentFeature.get('shape')].regular : false;
            }
        });
        let currentEditInteraction = null;
        selectInteraction.on('select', (evt) => {
            if (evt.selected.length === 1 && evt.selected[0] === this.currentFeature) {
                return;
            }
            if (this.currentFeature) {
                this.commitCurrentFeature();
            }
            if (currentEditInteraction) {
                this.props.map.removeInteraction(currentEditInteraction);
                currentEditInteraction = null;
            }
            if (evt.selected.length === 1) {
                this.setCurrentFeature(evt.selected[0]);
                const geomTypeConfig = GeomTypeConfig[this.currentFeature.get('shape')];
                if (geomTypeConfig && geomTypeConfig.editTool === 'Transform') {
                    this.props.map.addInteraction(transformInteraction);
                    transformInteraction.setSelection([this.currentFeature]);
                    currentEditInteraction = transformInteraction;
                } else {
                    this.props.map.addInteraction(modifyInteraction);
                    currentEditInteraction = modifyInteraction;
                }
            } else {
                this.props.changeRedliningState({
                    geomType: this.props.redlining.action === 'PickDraw' ? this.props.redlining.geomType : null,
                    selectedFeature: null
                });
            }
        }, this);
        modifyInteraction.on('modifyend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('rotateend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('translateend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('scaleend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('select', (ev) => {
            if (ev.feature && ev.feature !== this.currentFeature) {
                this.props.map.removeInteraction(transformInteraction);
                currentEditInteraction = null;
            }

        });
        if (this.props.redlining.action === 'PickDraw') {
            this.props.map.on('click', this.maybeEnterTemporaryDrawMode);
        }
        this.props.map.addInteraction(selectInteraction);
        this.interactions.push(selectInteraction, modifyInteraction, transformInteraction);
        this.picking = true;
    };
    addTransformInteraction = (layerChanged) => {
        this.reset(layerChanged);
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (!redliningLayer) {
            return;
        }
        const transformInteraction = new ol.interaction.Transform({
            stretch: false,
            keepAspectRatio: () => {
                return this.currentFeature ? GeomTypeConfig[this.currentFeature.get('shape')].regular : false;
            }
        });
        transformInteraction.on('select', (evt) => {
            if (evt.feature === this.currentFeature) {
                return;
            }
            if (this.currentFeature) {
                this.commitCurrentFeature();
            }
            if (evt.feature) {
                this.setCurrentFeature(evt.feature);
            }
        });
        transformInteraction.on('rotateend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('translateend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        transformInteraction.on('scaleend', () => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        this.props.map.addInteraction(transformInteraction);
        this.interactions.push(transformInteraction);
    };
    commitCurrentFeature = (newFeature = false) => {
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
                this.props.removeLayerFeatures(this.props.redlining.layer, [feature.id]);
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
        const layer = {
            id: this.props.redlining.layer,
            title: this.props.redlining.layerTitle,
            role: LayerRole.USERLAYER,
            queryable: false
        };
        this.props.addLayerFeatures(layer, [feature]);
        this.resetSelectedFeature();
    };
    deleteCurrentFeature = (oldProps) => {
        if (this.currentFeature) {
            this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()], true);
            this.currentFeature = null;
            this.props.changeRedliningState({...oldProps.redlining, selectedFeature: null});
        }
    };
    reset = (layerChanged = false) => {
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if (this.picking && !layerChanged) {
            this.commitCurrentFeature();
        } else {
            this.resetSelectedFeature();
        }
        this.props.map.un('click', this.maybeEnterTemporaryDrawMode);
        this.picking = false;
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
    searchRedliningLayer = (layerId) => {
        let redliningLayer = null;
        this.props.map.getLayers().forEach(olLayer => {
            if (olLayer.get('msId') === layerId) {
                redliningLayer = olLayer;
            }
        });
        return redliningLayer;
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

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    redlining: state.redlining,
    mapCrs: state.map.projection,
    displayCrs: displaycrs
}));

export default connect(selector, {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

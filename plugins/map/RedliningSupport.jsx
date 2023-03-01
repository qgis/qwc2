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
import {createSelector} from 'reselect';
import {v1 as uuidv4} from 'uuid';
import ol from 'openlayers';
import {changeRedliningState} from '../../actions/redlining';
import {LayerRole, addLayerFeatures, removeLayerFeatures} from '../../actions/layers';
import {OlLayerAdded, OlLayerUpdated} from '../../components/map/OlLayer';
import displayCrsSelector from '../../selectors/displaycrs';
import FeatureStyles from '../../utils/FeatureStyles';
import MeasureUtils from '../../utils/MeasureUtils';
import SnapInteraction from './SnapInteraction';

const DrawStyle = new ol.style.Style({
    image: new ol.style.Circle({
        fill: new ol.style.Fill({color: '#0099FF'}),
        stroke: new ol.style.Stroke({color: '#FFFFFF', width: 1.5}),
        radius: 6
    })
});

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
        removeLayerFeatures: PropTypes.func,
        snappingConfig: PropTypes.object
    };
    static defaultProps = {
        redlining: {}
    };
    constructor(props) {
        super(props);

        this.interactions = [];
        this.snapInteraction = null;
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
    componentDidUpdate(prevProps) {
        const layerChanged = this.props.redlining.layer !== prevProps.redlining.layer;
        if (this.props.redlining === prevProps.redlining) {
            // pass
        } else if (!this.props.redlining || !this.props.redlining.action) {
            this.reset(layerChanged);
        } else if ((this.props.redlining.action === 'Pick' || this.props.redlining.action === 'Buffer') && (prevProps.redlining.action !== this.props.redlining.action || layerChanged || (!this.props.redlining.selectedFeature && prevProps.redlining.selectedFeature))) {
            this.addPickInteraction(layerChanged);
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
        if (this.snapInteraction && this.props.snappingConfig.active !== prevProps.snappingConfig.active) {
            this.snapInteraction.setActive(this.props.snappingConfig.active);
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
    };
    styleProps = (feature) => {
        const styleOptions = feature.get('styleOptions');
        const label = feature.get("label") || "";
        return {
            borderColor: styleOptions.strokeColor,
            size: (styleOptions.strokeWidth - 1) * 2,
            fillColor: styleOptions.fillColor,
            text: label
        };
    };
    updateFeatureStyle = (styleProps) => {
        if (this.currentFeature) {
            const isText = this.currentFeature.get("shape") === "Text";
            const opts = this.styleOptions(styleProps);
            this.blockOnChange = true;
            this.currentFeature.set('label', styleProps.text);
            this.currentFeature.set('styleName', isText ? "text" : "default");
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
        this.updateFeatureStyle(newRedliningState.style);
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
            style: () => { return this.picking ? [] : DrawStyle; },
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
            const feature = this.currentFeature;
            this.commitCurrentFeature(true);
            if (geomTypeConfig.editTool === 'Transform') {
                this.enterTemporaryTransformMode(feature.getId(), this.props.redlining.layer);
            } else {
                this.enterTemporaryPickMode(feature.getId(), this.props.redlining.layer);
            }
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
    };
    updateMeasurements = (evt) => {
        if (this.blockOnChange) {
            return;
        }
        const feature = evt.target;
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
            const newStyleProps = {
                ...this.props.redlining.style,
                text: feature.get('label')
            };
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject(), style: newStyleProps});
        } else if (hadMeasurements) {
            feature.set('measurements', undefined);
            feature.set('segment_labels', undefined);
            feature.set('label', '');
            const newStyleProps = {
                ...this.props.redlining.style,
                text: ''
            };
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject(), style: newStyleProps});
        }
    };
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
            this.picking = true;
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
    };
    enterTemporaryTransformMode = (featureId, layerId) => {
        this.waitForFeatureAndLayer(layerId, featureId, (redliningLayer, feature) => {
            if (!feature) {
                return;
            }
            this.setCurrentFeature(feature);
            const transformInteraction = new ol.interaction.Transform({
                keepAspectRatio: () => {
                    return this.currentFeature ? GeomTypeConfig[this.currentFeature.get('shape')].regular : false;
                }
            });
            this.props.map.addInteraction(transformInteraction);
            transformInteraction.select(this.currentFeature, true);
            this.interactions.push(transformInteraction);
            this.picking = true;
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
    };
    leaveTemporaryEditMode = () => {
        if (this.currentFeature) {
            this.commitCurrentFeature();
        }
        if (this.picking) {
            // Remove modify interactions
            this.props.map.removeInteraction(this.interactions.pop());
            // If snapping interaction was added, it will remain as last interaction
            this.picking = false;
        }
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
            if (this.snapInteraction) {
                this.props.map.removeInteraction(this.snapInteraction);
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
                if (this.props.snappingConfig.enabled) {
                    this.snapInteraction = new SnapInteraction({source: redliningLayer.getSource()});
                    this.snapInteraction.setActive(this.props.snappingConfig.active);
                    this.props.map.addInteraction(this.snapInteraction);
                }
            } else {
                this.props.changeRedliningState({geomType: null, selectedFeature: null});
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
        this.props.map.addInteraction(selectInteraction);
        this.interactions = [selectInteraction, modifyInteraction];
        this.picking = true;
    };
    addTransformInteraction = (layerChanged) => {
        this.reset(layerChanged);
        const redliningLayer = this.searchRedliningLayer(this.props.redlining.layer);
        if (!redliningLayer) {
            return;
        }
        const transformInteraction = new ol.interaction.Transform({
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
        this.props.map.addInteraction(transformInteraction);
        this.interactions = [transformInteraction];
    };
    commitCurrentFeature = (newFeature = false) => {
        if (!this.currentFeature) {
            return;
        }
        this.updateFeatureStyle(this.props.redlining.style);
        const isText = this.currentFeature.get("shape") === "Text";
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
        feature.shape = this.currentFeature.get('shape');
        feature.measurements = this.currentFeature.get('measurements');
        // Don't pollute GeoJSON object properties with internal props
        delete feature.properties.styleName;
        delete feature.properties.styleOptions;
        delete feature.properties.isText;
        delete feature.properties.circleParams;
        delete feature.properties.shape;
        delete feature.properties.measurements;
        // Don't store empty label prop
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
    };
    resetSelectedFeature = () => {
        if (this.currentFeature) {
            // Reset selection style
            const isText = this.currentFeature.get("shape") === "Text";
            const style = FeatureStyles[isText ? "text" : "default"](this.currentFeature, this.currentFeature.get('styleOptions'));
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
        return format.writeFeatureObject(this.currentFeature);
    };
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    redlining: state.redlining,
    mapCrs: state.map.projection,
    displayCrs: displaycrs,
    snappingConfig: state.map.snapping
}));

export default connect(selector, {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

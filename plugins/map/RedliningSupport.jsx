/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const uuid = require('uuid');
const ol = require('openlayers');
const FeatureStyles = require('../../components/map/openlayers/FeatureStyles');
const {changeRedliningState} = require('../../actions/redlining');
const {LayerRole,addLayerFeatures,removeLayerFeatures} = require('../../actions/layers');

class RedliningSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        redlining: PropTypes.object,
        changeRedliningState: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        removeLayerFeatures: PropTypes.func
    }
    static defaultProps = {
        redlining: {}
    }
    constructor(props) {
        super(props);

        this.interactions = [];
        this.picking = false;
        this.currentFeature = null;
        this.selectedTextStyle = (feature, opts) => new ol.style.Style({
            text: new ol.style.Text({
                font: '10pt sans-serif',
                text: feature.getProperties()["label"] || "",
                scale: opts.strokeWidth,
                fill: new ol.style.Fill({color: opts.fillColor}),
                stroke: new ol.style.Stroke({color: [0,0,0,0.5], width: 4})
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
                if(f.getGeometry().getType() === "Point") {
                    return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
                } else if(f.getGeometry().getType() === "LineString") {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
                } else {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
                }
            }
        });
    }
    componentWillReceiveProps(newProps) {
        let layerChanged = newProps.redlining.layer !== this.props.redlining.layer;
        if(newProps.redlining == this.props.redlining) {
            // pass
        } else if(!newProps.redlining || !newProps.redlining.action) {
            this.reset();
        } else if((newProps.redlining.action === 'Pick' || newProps.redlining.action === 'Buffer') && (this.props.redlining.action !== newProps.redlining.action || layerChanged)) {
            this.addPickInteraction(newProps);
        } else if(newProps.redlining.action === 'Delete') {
            this.deleteCurrentFeature(this.props);
        } else if(newProps.redlining.action === 'Draw' && (this.props.redlining.action !== 'Draw' || newProps.redlining.geomType !== this.props.redlining.geomType || layerChanged)) {
            this.addDrawInteraction(newProps);
        } else if(newProps.redlining.style !== this.props.redlining.style) {
            this.updateFeatureStyle(newProps.redlining.style);
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
    updateFeatureStyle = (styleProps) => {
        if(this.currentFeature) {
            let isText = this.currentFeature.get("isText") === true;
            let styleName = isText ? "text" : "default";
            this.currentFeature.set('label', styleProps.text);
            let opts = this.styleOptions(styleProps);
            let style = FeatureStyles[styleName](this.currentFeature, opts);
            let styles = [];
            if(isText) {
                styles.push(this.selectedTextStyle(this.currentFeature, opts));
            }
            this.currentFeature.setStyle(styles.concat(style, this.selectedStyle));
        }
    }
    addDrawInteraction = (newProps) => {
        this.reset();
        let isText = newProps.redlining.geomType === "Text";
        let drawInteraction = new ol.interaction.Draw({
            type: isText ? "Point" : newProps.redlining.geomType,
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            style: new ol.style.Style()
        });
        drawInteraction.on('drawstart', (evt) => {
            this.leaveTemporaryPickMode();
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
            this.currentFeature.set('isText', isText);
            this.updateFeatureStyle(this.props.redlining.style);
        }, this);
        drawInteraction.on('drawend', (evt) => {
            let feature = this.currentFeature;
            this.commitCurrentFeature(true);
            this.enterTemporaryPickMode(feature, newProps.redlining.layer);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions = [drawInteraction];
    }
    enterTemporaryPickMode = (feature, layerId) => {
        let redliningLayer = this.searchRedliningLayer(layerId);
        if(!redliningLayer) {
            return;
        }
        this.currentFeature = redliningLayer.getSource().getFeatureById(feature.getId());
        if(!this.currentFeature) {
            return;
        }
        this.updateFeatureStyle(this.props.redlining.style);

        let modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection([this.currentFeature]),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            }
        });
        modifyInteraction.on('modifyend', evt => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        this.props.map.addInteraction(modifyInteraction);
        this.interactions.push(modifyInteraction);
        this.picking = true;
        this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
    }
    leaveTemporaryPickMode = () => {
        if(this.currentFeature) {
            this.commitCurrentFeature();
        }
        if(this.picking) {
            // Remote modify interactions
            this.props.map.removeInteraction(this.interactions.pop());
            this.picking = false;
        }
    }
    addPickInteraction = (newProps) => {
        this.reset();
        let redliningLayer = this.searchRedliningLayer(newProps.redlining.layer);
        if(!redliningLayer) {
            return;
        }

        let selectInteraction = new ol.interaction.Select({layers: [redliningLayer], hitTolerance: 5});
        let modifyInteraction = new ol.interaction.Modify({
            features: selectInteraction.getFeatures(),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            }
        });
        selectInteraction.on('select', (evt) => {
            if(evt.selected.length === 1 && evt.selected[0] == this.currentFeature) {
                return;
            }
            if(this.currentFeature) {
                this.commitCurrentFeature();
            }
            if(evt.selected.length === 1) {
                this.currentFeature = evt.selected[0];
                let newRedliningState = null;
                if(this.currentFeature.get("isText") === true) {
                    newRedliningState = {
                        geomType: 'Text',
                        style: {
                            borderColor: this.currentFeature.getStyle().getText().getStroke().getColor(),
                            fillColor: this.currentFeature.getStyle().getText().getFill().getColor(),
                            size: 2 * (this.currentFeature.getStyle().getText().getScale() - 1),
                            text: this.currentFeature.getStyle().getText().getText()
                        },
                        selectedFeature: this.currentFeatureObject()
                    };
                } else {
                    newRedliningState = {
                        geomType: this.currentFeature.getGeometry().getType(),
                        style: {
                            borderColor: this.currentFeature.getStyle().getStroke().getColor(),
                            fillColor: this.currentFeature.getStyle().getFill().getColor(),
                            size: 2 * (this.currentFeature.getStyle().getStroke().getWidth() - 1),
                            text: this.currentFeature.getStyle().getText().getText()
                        },
                        selectedFeature: this.currentFeatureObject()
                    };
                }
                this.updateFeatureStyle(newRedliningState.style);
                this.props.changeRedliningState(newRedliningState);
            } else {
                this.props.changeRedliningState({geomType: null, selectedFeature: null});
            }
        }, this);
        modifyInteraction.on('modifyend', evt => {
            this.props.changeRedliningState({selectedFeature: this.currentFeatureObject()});
        });
        this.props.map.addInteraction(selectInteraction);
        this.props.map.addInteraction(modifyInteraction);
        this.interactions = [selectInteraction, modifyInteraction];
        this.picking = true;
    }
    commitCurrentFeature = (newFeature = false) => {
        if(!this.currentFeature) {
            return;
        }
        let isText = this.currentFeature.get("isText") === true;
        if(isText && !this.currentFeature.get("label")) {
            if(!newFeature) {
                this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()])
            }
            this.resetSelectedFeature();
            return;
        }
        let format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        assign(feature, {styleName: isText ? "text" : "default", styleOptions: this.styleOptions(this.props.redlining.style)});
        let layer = {
            id: this.props.redlining.layer,
            title: this.props.redlining.layerTitle,
            role: LayerRole.USERLAYER
        };
        this.props.addLayerFeatures(layer, [feature]);
        this.resetSelectedFeature();
    }
    deleteCurrentFeature = (oldProps) => {
        if(this.currentFeature) {
            this.props.removeLayerFeatures(this.props.redlining.layer, [this.currentFeature.getId()]);
            this.currentFeature = null;
            this.props.changeRedliningState(assign({}, oldProps.redlining, {selectedFeature: null}));
        }
    }
    reset = () => {
        while(this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if(this.picking) {
            this.commitCurrentFeature();
        } else {
            this.resetSelectedFeature();
        }
        this.picking = false;
    }
    resetSelectedFeature = () => {
        if(this.currentFeature) {
            // Reset selection style
            let isText = this.currentFeature.get("isText") === true;
            let style = FeatureStyles[isText ? "text" : "default"](this.currentFeature, this.styleOptions(this.props.redlining.style));
            this.currentFeature.setStyle(style);
            this.currentFeature = null;
            this.props.changeRedliningState({selectedFeature: null});
        }
    }
    searchRedliningLayer = (layerId) => {
        let redliningLayer = null;
        this.props.map.getLayers().forEach(olLayer => {
            if(olLayer.get('msId') === layerId) {
                redliningLayer = olLayer;
            }
        });
        return redliningLayer;
    }
    currentFeatureObject = () => {
        if(!this.currentFeature) {
            return null;
        }
        let format = new ol.format.GeoJSON();
        return format.writeFeatureObject(this.currentFeature);
    }
};

module.exports = connect((state) => ({
    redlining: state.redlining || {}
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

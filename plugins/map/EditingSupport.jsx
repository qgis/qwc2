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
const {changeEditingState} = require('../../actions/editing');

class EditingSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        editing: PropTypes.object,
        changeEditingState: PropTypes.func
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
                    if(feature.getGeometry().getType() === "Point") {
                        return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                    } else if(feature.getGeometry().getType() === "LineString") {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                    } else {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                    }
                }
            })
        ];
    }
    componentWillReceiveProps(newProps) {
        if(newProps.editing === this.props.editing) {
            // pass
        } else if(newProps.editing.action === 'Pick' && newProps.editing.feature) {
            this.addEditInteraction(newProps);
        } else if(newProps.editing.action === 'Draw' && newProps.editing.geomType) {
            if(!newProps.editing.feature || this.props.editing.geomType !== newProps.editing.geomType) {
                this.addDrawInteraction(newProps);
            }
        } else {
            this.reset();
        }
    }
    render() {
        return null;
    }
    createLayer = () => {
        let source = new ol.source.Vector();
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
        let drawInteraction = new ol.interaction.Draw({
            type: newProps.editing.geomType,
            source: this.layer.getSource(),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            style: this.editStyle
        });
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
        }, this);
        drawInteraction.on('drawend', (evt) => {
            let feature = this.currentFeature;
            this.commitCurrentFeature();

            setTimeout(() => {
                this.currentFeature = feature;
                let modifyInteraction = new ol.interaction.Modify({
                    features: new ol.Collection([this.currentFeature]),
                    condition: (event) => {  return event.pointerEvent.buttons === 1 },
                    deleteCondition: (event) => {
                        // delete vertices on SHIFT + click
                        return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
                    }
                });
                this.props.map.addInteraction(modifyInteraction);
                this.interaction = modifyInteraction;
                modifyInteraction.on('modifyend', (evt) => {
                    this.commitCurrentFeature();
                }, this)

                this.props.map.removeInteraction(drawInteraction);
            }, 100);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interaction = drawInteraction;
    }
    addEditInteraction = (newProps) => {
        this.reset();
        this.createLayer();
        let format = new ol.format.GeoJSON();
        this.currentFeature = format.readFeature(newProps.editing.feature);
        this.layer.getSource().addFeature(this.currentFeature);

        let modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection([this.currentFeature]),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            }
        });
        modifyInteraction.on('modifyend', (evt) => {
            this.commitCurrentFeature();
        }, this);
        this.props.map.addInteraction(modifyInteraction);
        this.interaction = modifyInteraction;
    }
    commitCurrentFeature = () => {
        if(!this.currentFeature) {
            return;
        }
        let format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        this.props.changeEditingState({feature: feature, changed: true});
    }
    reset = () => {
        if(this.interaction) {
            this.props.map.removeInteraction(this.interaction);
        }
        this.interaction = null;
        this.currentFeature = null;
        if(this.layer) {
            this.props.map.removeLayer(this.layer);
        }
        this.layer = null;
    }
};

module.exports = connect((state) => ({
    editing: state.editing || {}
}), {
    changeEditingState: changeEditingState
})(EditingSupport);

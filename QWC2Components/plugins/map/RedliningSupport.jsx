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
var ol = require('openlayers');
const FeatureStyles = require('../../../MapStore2Components/components/map/openlayers/FeatureStyles');
const {changeRedliningState} = require('../../actions/redlining');
const {addLayerFeatures,removeLayerFeatures} = require('../../actions/layers');

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
        this.currentFeature = null;
        this.selectedStyle = new ol.style.Style({
                image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: 'white'}),
                stroke: new ol.style.Stroke({color: 'red', width: 2}),
                points: 4,
                radius: 5,
                angle: Math.PI / 4
            }),
            geometry: function(feature) {
                if(feature.getGeometry().getType() === "Point") {
                    return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                } else if(feature.getGeometry().getType() === "LineString") {
                    return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                } else {
                    return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                }
            }
        });
    }
    componentWillReceiveProps(newProps) {
        if(newProps.redlining == this.props.redlining) {
            // pass
        } else if(!newProps.redlining || !newProps.redlining.action) {
            this.reset();
        } else if(newProps.redlining.action === 'Pick' && this.props.redlining.action !== 'Pick') {
            this.addPickInteraction(newProps);
        } else if(newProps.redlining.action === 'Delete') {
            this.deleteCurrentFeature(this.props);
        } else if(newProps.redlining.action === 'Draw' && newProps.redlining.geomType !== this.props.redlining.geomType ) {
            this.addDrawInteraction(newProps);
        } else {
            this.updateFeatureStyle(newProps.redlining);
        }
    }
    render() {
        return null;
    }
    styleOptions = (redlining) => {
        return {
            strokeColor: redlining.borderColor,
            strokeWidth: redlining.size,
            fillColor: redlining.fillColor,
            circleRadius: 5 + redlining.size,
            strokeDash: []
        };
    }
    updateFeatureStyle = (redlining) => {
        if(this.currentFeature) {
            this.currentFeature.set('label', redlining.text);
            let style = FeatureStyles['default'](this.currentFeature, this.styleOptions(redlining));
            this.currentFeature.setStyle([style, this.selectedStyle]);
        }
    }
    addDrawInteraction = (newProps) => {
        this.reset();
        let drawInteraction = new ol.interaction.Draw({
            type: newProps.redlining.geomType,
            style: new ol.style.Style()
        });
        drawInteraction.on('drawstart', function(evt) {
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
            this.updateFeatureStyle(this.props.redlining);
        }, this);
        drawInteraction.on('drawend', function(evt) {
            this.commitCurrentFeature();
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions = [drawInteraction];
    }
    addPickInteraction = () => {
        this.reset();
        // Look for redlining layer
        let redliningLayer = null;
        this.props.map.getLayers().forEach(olLayer => {
            if(olLayer.get('msId') === 'redlining') {
                redliningLayer = olLayer;
            }
        });
        if(!redliningLayer) {
            return;
        }

        let selectInteraction = new ol.interaction.Select({layers: [redliningLayer]});
        let modifyInteraction = new ol.interaction.Modify({features: selectInteraction.getFeatures()});
        selectInteraction.on('select', function(evt) {
            if(evt.selected.length === 1 && evt.selected[0] == this.currentFeature) {
                return;
            }
            if(this.currentFeature) {
                this.commitCurrentFeature();
            }
            if(evt.selected.length === 1) {
                this.currentFeature = evt.selected[0];
                this.props.changeRedliningState(assign({}, this.props.redlining, {
                    action: 'Pick',
                    geomType: null,
                    borderColor: this.currentFeature.getStyle().getStroke().getColor(),
                    fillColor: this.currentFeature.getStyle().getFill().getColor(),
                    size: this.currentFeature.getStyle().getStroke().getWidth(),
                    text: this.currentFeature.getStyle().getText().getText()
                }));
            }
        }, this);
        this.props.map.addInteraction(selectInteraction);
        this.props.map.addInteraction(modifyInteraction);
        this.interactions = [selectInteraction, modifyInteraction];
    }
    commitCurrentFeature = () => {
        if(!this.currentFeature) {
            return;
        }
        let format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        assign(feature, {styleName: 'default', styleOptions: this.styleOptions(this.props.redlining)});
        let layer = {
            id: "redlining",
            title: "Redlining",
            visibility: true,
            queryable: false,
            zIndex: 1000000
        };
        this.props.addLayerFeatures(layer, [feature]);
        this.resetSelectedFeature();
    }
    deleteCurrentFeature = (oldProps) => {
        if(this.currentFeature) {
            this.props.removeLayerFeatures("redlining", this.currentFeature.getId());
            this.currentFeature = null;
        }
        this.props.changeRedliningState(assign({}, oldProps.redlining));
    }
    reset = () => {
        while(this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        this.resetSelectedFeature();
    }
    resetSelectedFeature = () => {
        if(this.currentFeature) {
            // Reset selection style
            let style = FeatureStyles['default'](this.currentFeature, this.styleOptions(this.props.redlining));
            this.currentFeature.setStyle(style);
            this.currentFeature = null;
        }
    }
};

module.exports = connect((state) => ({
    redlining: state.redlining || {}
}), {
    changeRedliningState: changeRedliningState,
    addLayerFeatures: addLayerFeatures,
    removeLayerFeatures: removeLayerFeatures
})(RedliningSupport);

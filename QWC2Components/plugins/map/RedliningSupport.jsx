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
var ol = require('openlayers');
const {changeRedliningState} = require('../../actions/redlining');

class RedliningSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        redlining: PropTypes.object,
        changeRedliningState: PropTypes.func
    }
    static defaultProps = {
        redlining: {}
    }
    constructor(props) {
        super(props);

        this.redliningLayer = null;
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
            this.deleteCurrent(this.props);
        } else if(newProps.redlining.action === 'Draw' && newProps.redlining.geomType !== this.props.redlining.geomType ) {
            this.addDrawInteraction(newProps);
        } else {
            this.updateFeatureStyle(newProps);
        }
    }
    render() {
        return null;
    }
    createLayer = () => {
      this.source = new ol.source.Vector();
      this.redliningLayer = new ol.layer.Vector({
          source: this.source,
          zIndex: 1000000
      });
      this.props.map.addLayer(this.redliningLayer);
    }
    createStyle = (props) => {
        return new ol.style.Style({
            fill: new ol.style.Fill({
                color: props.redlining.fillColor
            }),
            stroke: new ol.style.Stroke({
                color: props.redlining.borderColor,
                width: props.redlining.size
            }),
            image: new ol.style.Circle({
                radius: 5 + props.redlining.size,
                fill: new ol.style.Fill({ color: props.redlining.fillColor }),
                stroke: new ol.style.Stroke({color: props.redlining.borderColor, width: props.redlining.size})
            }),
            text: new ol.style.Text({
              font: '12pt sans',
              text: props.redlining.text,
              fill: new ol.style.Fill({color: 'black'}),
              stroke: new ol.style.Stroke({color: 'white', width: 2})
            })
        });
    }
    updateFeatureStyle = (newProps) => {
        this.currentStyle = this.createStyle(newProps);
        if(this.currentFeature) {
            this.currentFeature.setStyle([this.currentStyle, this.selectedStyle]);
        }
    }
    deleteCurrent = (oldProps) => {
        if(this.currentFeature) {
            try {
                this.source.removeFeature(this.currentFeature);
            } catch(err) {
            }
            this.currentFeature = null;
        }
        this.props.changeRedliningState(assign({}, oldProps.redlining));
    }
    addDrawInteraction = (newProps) => {
        this.reset();
        if(!this.redliningLayer) {
          this.createLayer();
        }

        // create an interaction to draw with
        this.currentStyle = this.createStyle(newProps);
        let drawInteraction = new ol.interaction.Draw({
            source: this.source,
            type: newProps.redlining.geomType,
            style: new ol.style.Style()
        });
        drawInteraction.on('drawstart', function(evt) {
            if(this.currentFeature) {
                this.currentFeature.setStyle(this.currentStyle);
                this.currentFeature = null;
            }
            this.currentFeature = evt.feature;
            this.currentFeature.setStyle([this.currentStyle, this.selectedStyle]);
        }, this);
        drawInteraction.on('drawend', function(evt) {
            this.currentFeature.setStyle(this.currentStyle);
            this.currentFeature = null;
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interactions = [drawInteraction];
    }
    addPickInteraction = () => {
        this.reset();
        if(!this.redliningLayer) {
            return;
        }
        let selectInteraction = new ol.interaction.Select();
        let modifyInteraction = new ol.interaction.Modify({features: selectInteraction.getFeatures()});
        selectInteraction.on('select', function(evt) {
            if(evt.selected.length === 1 && evt.selected[0] == this.currentFeature) {
                return;
            }
            if(this.currentFeature) {
                this.currentFeature.setStyle(this.currentStyle);
                this.currentFeature = null;
            }
            if(evt.selected.length === 1) {
                this.currentFeature = evt.selected[0];
                this.props.changeRedliningState(assign({}, this.props.redlining, {
                    action: 'Pick',
                    geomType: this.currentFeature.getGeometry().getType(),
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
    reset = () => {
        while(this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        if(this.currentFeature) {
            this.currentFeature.setStyle(this.currentStyle);
            this.currentFeature = null;
        }
    }
};

module.exports = connect((state) => ({
    redlining: state.redlining || {}
}), {
    changeRedliningState: changeRedliningState
})(RedliningSupport);

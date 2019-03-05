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
const isEmpty = require('lodash.isempty');
const ol = require('openlayers');
const {changeRedliningPickState} = require('../../actions/redliningPick');

class RedliningPickSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        redliningPick: PropTypes.object,
        changeState: PropTypes.func
    }
    constructor(props) {
        super(props);

        this.interactions = [];
        this.selectedFeatures = [];
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
        if(newProps.redliningPick === this.props.redliningPick) {
            // pass
        } else if(!newProps.redliningPick.active && this.props.redliningPick.active) {
            this.reset(newProps.redliningPick.layer);
        } else if(newProps.redliningPick.active && !this.props.redliningPick.active) {
            this.addPickInteraction(newProps.redliningPick.layer);
        } else if(
            newProps.redliningPick.active == this.props.redliningPick.active &&
            isEmpty(newProps.redliningPick.selectedFeatures) && !isEmpty(this.props.redliningPick.selectedFeatures))
        {
            // Re-initialize
            this.reset(this.props.redliningPick.layer);
            this.addPickInteraction(newProps.redliningPick.layer);
        }
    }
    render() {
        return null;
    }
    addPickInteraction = (layerId) => {
        this.reset(layerId);
        let redliningLayer = this.searchRedliningLayer(layerId);
        if(!redliningLayer) {
            return;
        }

        let selectInteraction = new ol.interaction.Select({
            layers: [redliningLayer],
            toggleCondition: () => true}
        );
        selectInteraction.on('select', (evt) => {
            let selectedFeatures = this.props.redliningPick.selectedFeatures.slice(0);
            // Add newly selected features
            for(let feature of evt.selected || []) {
                // Skip text features for now
                if(feature.get("isText")) {
                    continue;
                }
                selectedFeatures.push(feature.getId());
                this.selectFeature(feature);
            }
            // Deselect currently selected features
            for(let feature of evt.deselected || []) {
                selectedFeatures = selectedFeatures.filter(id => id !== feature.getId());
                this.deselectFeature(feature);
            }
            this.props.changeRedliningPickState({selectedFeatures});
        }, this);
        this.props.map.addInteraction(selectInteraction);
        this.interactions = [selectInteraction];
    }
    reset = (layerId) => {
        while(this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        this.deselectAllFeatures(layerId);
        this.props.changeRedliningPickState({selectedFeatures: []});
    }
    selectFeature = (feature) => {
        let style = feature.getStyle();
        if(Array.isArray(style)) {
            style = [...style, this.selectedStyle];
        } else {
            style = [style, this.selectedStyle];
        }
        feature.setStyle(style);
    }
    deselectFeature = (feature) => {
        let style = feature.getStyle();
        if(Array.isArray(style)) {
            style = feature.getStyle().filter(entry => entry !== this.selectedStyle)
            feature.setStyle(style.length > 1 ? style : style[0]);
        }
    }
    deselectAllFeatures = (layerId) => {
        let redliningLayer = this.searchRedliningLayer(layerId);
        if(redliningLayer) {
            for(let id of this.props.redliningPick.selectedFeatures || []) {
                let feature = redliningLayer.getSource().getFeatureById(id);
                if(feature) {
                    this.deselectFeature(feature);
                }
            }
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
};

module.exports = connect((state) => ({
    redliningPick: state.redliningPick || {}
}), {
    changeRedliningPickState: changeRedliningPickState
})(RedliningPickSupport);

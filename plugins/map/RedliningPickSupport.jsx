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
import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import {changeRedliningPickState} from '../../actions/redliningPick';

class RedliningPickSupport extends React.Component {
    static propTypes = {
        changeRedliningPickState: PropTypes.func,
        changeState: PropTypes.func,
        map: PropTypes.object,
        redliningPick: PropTypes.object
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
                if (f.getGeometry().getType() === "Point") {
                    return new ol.geom.MultiPoint([f.getGeometry().getCoordinates()]);
                } else if (f.getGeometry().getType() === "LineString") {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates());
                } else {
                    return new ol.geom.MultiPoint(f.getGeometry().getCoordinates()[0]);
                }
            }
        });
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.redliningPick === prevProps.redliningPick) {
            // pass
        } else if (!this.props.redliningPick.active && prevProps.redliningPick.active) {
            this.reset(this.props.redliningPick.layer);
        } else if (this.props.redliningPick.active && !prevProps.redliningPick.active) {
            this.addPickInteraction(this.props.redliningPick.layer);
        } else if (
            this.props.redliningPick.active === prevProps.redliningPick.active &&
            isEmpty(this.props.redliningPick.selectedFeatures) && !isEmpty(prevProps.redliningPick.selectedFeatures)
        ) {
            // Re-initialize
            this.reset(prevProps.redliningPick.layer);
            this.addPickInteraction(this.props.redliningPick.layer);
        }
    }
    render() {
        return null;
    }
    addPickInteraction = (layerId) => {
        this.reset(layerId);
        const redliningLayer = this.searchRedliningLayer(layerId);
        if (!redliningLayer) {
            return;
        }

        const selectInteraction = new ol.interaction.Select({
            layers: [redliningLayer],
            toggleCondition: () => true}
        );
        selectInteraction.on('select', (evt) => {
            let selectedFeatures = this.props.redliningPick.selectedFeatures.slice(0);
            // Add newly selected features
            for (const feature of evt.selected || []) {
                // Skip text features for now
                if (feature.get("isText")) {
                    continue;
                }
                selectedFeatures.push(feature.getId());
                this.selectFeature(feature);
            }
            // Deselect currently selected features
            for (const feature of evt.deselected || []) {
                selectedFeatures = selectedFeatures.filter(id => id !== feature.getId());
                this.deselectFeature(feature);
            }
            this.props.changeRedliningPickState({selectedFeatures});
        }, this);
        this.props.map.addInteraction(selectInteraction);
        this.interactions = [selectInteraction];
    }
    reset = (layerId) => {
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        this.deselectAllFeatures(layerId);
        this.props.changeRedliningPickState({selectedFeatures: []});
    }
    selectFeature = (feature) => {
        let style = feature.getStyle();
        if (Array.isArray(style)) {
            style = [...style, this.selectedStyle];
        } else {
            style = [style, this.selectedStyle];
        }
        feature.setStyle(style);
    }
    deselectFeature = (feature) => {
        let style = feature.getStyle();
        if (Array.isArray(style)) {
            style = feature.getStyle().filter(entry => entry !== this.selectedStyle);
            feature.setStyle(style.length > 1 ? style : style[0]);
        }
    }
    deselectAllFeatures = (layerId) => {
        const redliningLayer = this.searchRedliningLayer(layerId);
        if (redliningLayer) {
            for (const id of this.props.redliningPick.selectedFeatures || []) {
                const feature = redliningLayer.getSource().getFeatureById(id);
                if (feature) {
                    this.deselectFeature(feature);
                }
            }
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
}

export default connect((state) => ({
    redliningPick: state.redliningPick
}), {
    changeRedliningPickState: changeRedliningPickState
})(RedliningPickSupport);

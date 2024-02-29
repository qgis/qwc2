/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import PropTypes from 'prop-types';

import {changeRedliningPickState} from '../../actions/redliningPick';
import FeatureStyles from "../../utils/FeatureStyles";

class RedliningPickSupport extends React.Component {
    static propTypes = {
        changeRedliningPickState: PropTypes.func,
        changeState: PropTypes.func,
        map: PropTypes.object,
        redliningPick: PropTypes.object
    };
    constructor(props) {
        super(props);

        this.interactions = [];
        this.selectedFeatures = [];
        const geometryFunction = (feature) => {
            if (feature.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
            } else if (feature.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
            }
            return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
        };
        this.selectedStyle = FeatureStyles.interactionVertex({geometryFunction});
    }
    componentDidUpdate(prevProps) {
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
                if (feature.shape === "Text") {
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
    };
    reset = (layerId) => {
        while (this.interactions.length > 0) {
            this.props.map.removeInteraction(this.interactions.shift());
        }
        this.deselectAllFeatures(layerId);
        this.props.changeRedliningPickState({selectedFeatures: []});
    };
    selectFeature = (feature) => {
        let style = feature.getStyle();
        if (Array.isArray(style)) {
            style = [...style, this.selectedStyle];
        } else {
            style = [style, this.selectedStyle];
        }
        feature.setStyle(style);
    };
    deselectFeature = (feature) => {
        let style = feature.getStyle();
        if (Array.isArray(style)) {
            style = feature.getStyle().filter(entry => entry !== this.selectedStyle);
            feature.setStyle(style.length > 1 ? style : style[0]);
        }
    };
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
}

export default connect((state) => ({
    redliningPick: state.redliningPick
}), {
    changeRedliningPickState: changeRedliningPickState
})(RedliningPickSupport);

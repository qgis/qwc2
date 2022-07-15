/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import ol from 'openlayers';
import {changeSelectionState} from '../../actions/selection';
import FeatureStyles from '../../utils/FeatureStyles';


class SelectionSupport extends React.Component {
    static propTypes = {
        changeSelectionState: PropTypes.func,
        map: PropTypes.object,
        projection: PropTypes.string,
        selection: PropTypes.object
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.selection.geomType && this.props.selection.geomType !== prevProps.selection.geomType ) {
            this.addDrawInteraction(this.props);
        }

        if (!this.props.selection.geomType) {
            this.removeDrawInteraction();
        }
        if (this.props.selection.reset) {
            this.removeDrawInteraction();
            this.props.changeSelectionState({
                geomType: prevProps.selection.geomType,
                style: prevProps.selection.style,
                styleOptions: prevProps.selection.styleOptions
            });
        }
    }
    render() {
        return null;
    }
    addDrawInteraction = (newProps) => {
        // cleanup old interaction
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        // create a layer to draw on
        const source = new ol.source.Vector();
        const vector = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: feature => FeatureStyles[newProps.selection.style](feature, newProps.selection.styleOptions)
        });

        this.props.map.addLayer(vector);

        // create an interaction to draw with
        const draw = new ol.interaction.Draw({
            stopClick: true,
            source: source,
            condition: event => event.originalEvent.buttons === 1,
            type: newProps.selection.geomType,
            style: feature => FeatureStyles.default(feature, {circleRadius: 0})
        });

        draw.on('drawstart', (evt) => {
            // preserv the sketch feature of the draw controller
            // to update length/area on drawing a new vertex
            this.sketchFeature = evt.feature;
            // clear previous sketches
            source.clear();
        }, this);
        draw.on('drawend', () => {
            this.updateSelectionState();
        }, this);

        this.props.map.addInteraction(draw);
        this.drawInteraction = draw;
        this.selectionLayer = vector;
        this.setDoubleClickZoomEnabled(false);

        if (newProps.selection.cursor) {
            this.props.map.getViewport().style.cursor = newProps.selection.cursor;
        }
    }
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.selectionLayer);
            this.sketchFeature = null;
            // Delay execution of activation of double click zoom function
            setTimeout(() => this.setDoubleClickZoomEnabled(true), 251);
        }
        this.props.map.getViewport().style.cursor = '';
    }
    updateSelectionState = () => {
        if (!this.sketchFeature) {
            return;
        }
        const sketchCoords = this.sketchFeature.getGeometry().getCoordinates();

        const newSelectionState = {...this.props.selection,
            point: this.props.selection.geomType === 'Point' ?
                [sketchCoords[0], sketchCoords[1]] : null,
            line: this.props.selection.geomType === 'LineString' ?
                sketchCoords.map(coo => [coo[0], coo[1]]) : null,
            polygon: this.props.selection.geomType === 'Polygon' ?
                this.sketchFeature.getGeometry().getLinearRing(0).getCoordinates().map(coo => [coo[0], coo[1]]) : null
        };
        this.props.changeSelectionState(newSelectionState);
    }
    setDoubleClickZoomEnabled = (enabled) => {
        const interactions = this.props.map.getInteractions();
        for (let i = 0; i < interactions.getLength(); i++) {
            const interaction = interactions.item(i);
            if (interaction instanceof ol.interaction.DoubleClickZoom) {
                interaction.setActive(enabled);
                break;
            }
        }
    }
}


export default connect((state) => ({
    selection: state.selection
}), {
    changeSelectionState
})(SelectionSupport);

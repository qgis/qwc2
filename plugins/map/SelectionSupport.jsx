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
import './style/SelectionSupport.css';


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

        let interaction = null;

        if (this.props.selection.geomType === "DragBox") {
            interaction = new ol.interaction.DragBox({
                className: 'selection-drag-box',
                condition: ol.events.condition.shiftKeyOnly
            });

            interaction.on('boxend', () => {
                this.updateSelectionState(interaction.getGeometry());
            });
        } else {
            const typeMap = {
                Text: "Point",
                Point: "Point",
                LineString: "LineString",
                Polygon: "Polygon",
                Circle: "Circle",
                Box: "Circle"
            };

            // create an interaction to draw with
            interaction = new ol.interaction.Draw({
                stopClick: true,
                source: source,
                condition: event => event.originalEvent.buttons === 1,
                type: typeMap[this.props.selection.geomType],
                style: feature => FeatureStyles.default(feature, {circleRadius: 0}),
                geometryFunction: this.props.selection.geomType === "Box" ? ol.interaction.createBox() : undefined
            });

            interaction.on('drawstart', () => {
                // clear previous sketches
                source.clear();
            }, this);
            interaction.on('drawend', (evt) => {
                this.updateSelectionState(evt.feature.getGeometry());
            }, this);
        }

        this.props.map.addInteraction(interaction);
        this.drawInteraction = interaction;
        this.selectionLayer = vector;

        if (newProps.selection.cursor) {
            this.props.map.getViewport().style.cursor = newProps.selection.cursor;
        }
    }
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.selectionLayer);
        }
        this.props.map.getViewport().style.cursor = '';
    }
    updateSelectionState = (geometry) => {
        if (!geometry) {
            return;
        }
        const coords = this.props.selection.geomType === 'Circle' ? null : geometry.getCoordinates();

        const newSelectionState = {...this.props.selection,
            point: this.props.selection.geomType === 'Point' ?
                [coords[0], coords[1]] : null,
            line: this.props.selection.geomType === 'LineString' ?
                coords.map(coo => [coo[0], coo[1]]) : null,
            polygon: this.props.selection.geomType === 'Polygon' ?
                coords[0].map(coo => [coo[0], coo[1]]) : null,
            circle: this.props.selection.geomType === 'Circle' ?
                {center: geometry.getCenter(), radius: geometry.getRadius()} : null,
            box: this.props.selection.geomType === 'DragBox' || this.props.selection.geomType === 'Box' ?
                [
                    Math.min(coords[0][0][0], coords[0][2][0]),
                    Math.min(coords[0][0][1], coords[0][2][1]),
                    Math.max(coords[0][0][0], coords[0][2][0]),
                    Math.max(coords[0][0][1], coords[0][2][1])
                ] : null
        };
        this.props.changeSelectionState(newSelectionState);
    }
}


export default connect((state) => ({
    selection: state.selection
}), {
    changeSelectionState
})(SelectionSupport);

/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
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
import MeasureUtils from '../../utils/MeasureUtils';
import './style/SelectionSupport.css';


class SelectionSupport extends React.Component {
    static propTypes = {
        changeSelectionState: PropTypes.func,
        map: PropTypes.object,
        projection: PropTypes.string,
        selection: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.layerSource = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.selection.geomType && this.props.selection.geomType !== prevProps.selection.geomType ) {
            this.addDrawInteraction(this.props);
        }
        if (this.props.selection.active !== prevProps.selection.active && this.drawInteraction) {
            this.drawInteraction.setActive(this.props.selection.active);
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

        // Geometry specific handling
        if (this.props.selection.circle && this.props.selection.circle.radius !== prevProps.selection.circle?.radius && !this.props.selection.internalStateUpdate) {

            const feature = this.layerSource.getFeatures()[0];
            if (feature) {
                feature.getGeometry().setRadius(this.props.selection.circle.radius);
            }
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
        this.layerSource = new ol.source.Vector();
        const vector = new ol.layer.Vector({
            source: this.layerSource,
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
                source: this.layerSource,
                condition: event => event.originalEvent.buttons === 1,
                type: typeMap[this.props.selection.geomType],
                style: feature => FeatureStyles.default(feature, {circleRadius: 0}),
                geometryFunction: this.props.selection.geomType === "Box" ? ol.interaction.createBox() : undefined
            });

            interaction.on('drawstart', (evt) => {
                // clear previous sketches
                this.layerSource.clear();
                evt.feature.on('change', () => this.updateMeasurements(evt.feature));
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
    };
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.selectionLayer);
            this.layerSource = null;
        }
        this.props.map.getViewport().style.cursor = '';
    };
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
        if (this.props.selection.geomType === 'Circle') {
            // Also store poligonized circle
            const center = newSelectionState.circle.center;
            const radius = newSelectionState.circle.radius;
            const deg2rad = Math.PI / 180;
            newSelectionState.polygon = Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]));
        }
        this.props.changeSelectionState(newSelectionState,  true);
    };
    updateMeasurements = (feature) => {
        if (!this.props.selection.measure) {
            return;
        }
        const settings = {
            mapCrs: this.props.projection,
            displayCrs: this.props.projection,
            lenUnit: 'metric',
            areaUnit: 'metric',
            decimals: 2
        };
        MeasureUtils.updateFeatureMeasurements(feature, this.props.selection.geomType, this.props.projection, settings);
    };
}


export default connect((state) => ({
    selection: state.selection
}), {
    changeSelectionState
})(SelectionSupport);

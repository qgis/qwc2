/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import FeatureStyles from '../utils/FeatureStyles';
import MapUtils from '../utils/MapUtils';
import MeasureUtils from '../utils/MeasureUtils';


class MapSelection extends React.Component {
    static propTypes = {
        /* Whether the selection tool is active */
        active: PropTypes.bool,
        /* Optional, a css-cursor to use when drawing */
        cursor: PropTypes.string,
        /* The selection geometry type (Point, LineString, Polygon, Circle, DragBox, Box) */
        geomType: PropTypes.string,
        /* Initial geometry or geometry to update. */
        geometry: PropTypes.object,
        /* The callback which is invoked with a drawn geometry. */
        geometryChanged: PropTypes.func,
        /* Whether to show measurements while drawing. */
        measure: PropTypes.bool,
        projection: PropTypes.string,
        /* Optional: the selection feature style name. */
        styleName: PropTypes.string,
        /* Optional: the selection feature style options. */
        styleOptions: PropTypes.object
    };
    static defaultProps = {
        styleName: 'default',
        styleOptions: {}
    };
    state = {
        geometry: null
    };
    constructor(props) {
        super(props);
        this.drawInteraction = null;
        this.map = MapUtils.getHook(MapUtils.GET_MAP);

        // create a layer to draw on
        this.selectionLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: 1000000,
            style: feature => FeatureStyles[this.props.styleName](feature, this.props.styleOptions)
        });

        this.map.addLayer(this.selectionLayer);
    }
    componentDidMount() {
        if (this.props.active) {
            this.addDrawInteraction();
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.geomType !== prevProps.geomType) {
            this.selectionLayer.getSource().clear();
        }
        if ((this.props.active && !prevProps.active) || (this.props.active && this.props.geomType !== prevProps.geomType)) {
            this.addDrawInteraction();
        } else if (!this.props.active && prevProps.active) {
            this.removeDrawInteraction();
        }
        if (this.state.geometry !== prevState.geometry) {
            if (this.state.geometry !== this.props.geometry) {
                this.props.geometryChanged(this.state.geometry);
            }
        }
        if (this.props.geometry !== prevProps.geometry && this.props.geometry !== this.state.geometry) {
            if (!this.props.geometry) {
                this.selectionLayer.getSource().clear();
            } else {
                let feature = this.selectionLayer.getSource().getFeatures()[0];
                if (!feature) {
                    feature = new ol.Feature();
                    this.selectionLayer.getSource().addFeature(feature);
                }
                if (this.props.geometry.type === "Point") {
                    feature.setGeometry(new ol.geom.Point(this.props.geometry.coordinates));
                } else if (this.props.geometry.type === "LineString") {
                    feature.setGeometry(new ol.geom.LineString(this.props.geometry.coordinates));
                } else if (this.props.geometry.type === "Polygon") {
                    if (this.props.geometry.center && this.props.geometry.radius) {
                        feature.setGeometry(new ol.geom.Circle(this.props.geometry.center, this.props.geometry.radius));
                    } else {
                        feature.setGeometry(new ol.geom.Polygon(this.props.geometry.coordinates));
                    }
                }
                this.setState({geometry: this.props.geometry});
            }
        }
    }
    componentWillUnmount() {
        this.map.removeLayer(this.selectionLayer);
        this.removeDrawInteraction();
    }
    addDrawInteraction = () => {
        // cleanup old interaction
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        if (this.props.geomType === "DragBox") {
            this.drawInteraction = new ol.interaction.DragBox({
                className: 'selection-drag-box'
            });

            this.drawInteraction.on('boxend', () => {
                this.updateSelectionState(this.drawInteraction.getGeometry());
            });
        } else {
            const typeMap = {
                Point: "Point",
                LineString: "LineString",
                Polygon: "Polygon",
                Circle: "Circle",
                Box: "Circle"
            };

            // create an interaction to draw with
            this.drawInteraction = new ol.interaction.Draw({
                stopClick: true,
                source: this.selectionLayer.getSource(),
                condition: event => event.originalEvent.buttons === 1,
                type: typeMap[this.props.geomType],
                style: feature => FeatureStyles[this.props.styleName](feature, {...this.props.styleOptions, circleRadius: 0}),
                geometryFunction: this.props.geomType === "Box" ? ol.interaction.createBox() : undefined
            });

            this.drawInteraction.on('drawstart', (evt) => {
                // clear previous sketches
                this.selectionLayer.getSource().clear();
                evt.feature.on('change', () => this.updateMeasurements(evt.feature));
            }, this);
            this.drawInteraction.on('drawend', (evt) => {
                this.updateSelectionState(evt.feature.getGeometry());
            }, this);
        }

        this.map.addInteraction(this.drawInteraction);

        if (this.props.cursor) {
            this.map.getViewport().style.cursor = this.props.cursor;
        }
    };
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
        }
        this.map.getViewport().style.cursor = '';
    };
    updateSelectionState = (geometry) => {
        if (!geometry) {
            return;
        }
        const coords = this.props.geomType === 'Circle' ? null : geometry.getCoordinates();

        if (this.props.geomType === "Point") {
            this.setState({geometry: {type: "Point", coordinates: coords}});
        } else if (this.props.geomType === "LineString") {
            this.setState({geometry: {type: "LineString", coordinates: coords}});
        } else if (this.props.geomType === "Polygon") {
            this.setState({geometry: {type: "Polygon", coordinates: coords}});
        } else if (this.props.geomType === "Circle") {
            // Also store poligonized circle
            const center = geometry.getCenter();
            const radius = geometry.getRadius();
            const deg2rad = Math.PI / 180;
            const polycords = [Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))];
            this.setState({geometry: {type: "Polygon", coordinates: polycords, center, radius}});
        } else if (this.props.geomType === "DragBox" || this.props.geomType === "Box") {
            const boxcoords = [[
                Math.min(coords[0][0][0], coords[0][2][0]),
                Math.min(coords[0][0][1], coords[0][2][1]),
                Math.max(coords[0][0][0], coords[0][2][0]),
                Math.max(coords[0][0][1], coords[0][2][1])
            ]];
            this.setState({geometry: {type: "Polygon", coordinates: boxcoords}});
        }
    };
    updateMeasurements = (feature) => {
        if (!this.props.measure) {
            return;
        }
        const settings = {
            mapCrs: this.props.projection,
            displayCrs: this.props.projection,
            lenUnit: 'metric',
            areaUnit: 'metric',
            decimals: 0
        };
        MeasureUtils.updateFeatureMeasurements(feature, this.props.geomType, this.props.projection, settings);
    };
    render() {
        return null;
    }
}

export default connect((state) => ({
    projection: state.map.projection
}), {
})(MapSelection);

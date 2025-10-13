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
        /** Whether the selection tool is active */
        active: PropTypes.bool,
        /** Optional, a css-cursor to use when drawing */
        cursor: PropTypes.string,
        /** The draw interaction condition. */
        drawCondition: PropTypes.func,
        /** The selection geometry type (Point, LineString, Polygon, Circle, DragBox, Box) */
        geomType: PropTypes.string,
        /** Initial geometry or geometry to update. */
        geometry: PropTypes.object,
        /** The callback which is invoked with a drawn geometry. */
        geometryChanged: PropTypes.func,
        /** Whether to hide the current selection (except while drawing). */
        hideGeometry: PropTypes.bool,
        /** Whether to show measurements while drawing. */
        measure: PropTypes.bool,
        projection: PropTypes.string,
        /** Optional: the selection feature style name. */
        styleName: PropTypes.string,
        /** Optional: the selection feature style options. */
        styleOptions: PropTypes.object
    };
    static defaultProps = {
        drawCondition: event => event.originalEvent.buttons === 1,
        styleName: 'default',
        styleOptions: {}
    };
    state = {
        geometry: null,
        modifiers: {alt: false, ctrl: false, shift: false}
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

        this.selectionLayer.setVisible(!this.props.hideGeometry);
    }
    componentDidMount() {
        this.map.addLayer(this.selectionLayer);
        if (this.props.active) {
            this.addDrawInteraction();
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.hideGeometry !== prevProps.hideGeometry) {
            this.selectionLayer.setVisible(!this.props.hideGeometry);
        }
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
                this.props.geometryChanged(this.state.geometry, {...this.state.modifiers});
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
                } else if (this.props.geometry.type === "MultiPoint") {
                    feature.setGeometry(new ol.geom.Multi(this.props.geometry.coordinates));
                } else if (this.props.geometry.type === "LineString") {
                    feature.setGeometry(new ol.geom.LineString(this.props.geometry.coordinates));
                } else if (this.props.geometry.type === "MultiLineString") {
                    feature.setGeometry(new ol.geom.MultiLineString(this.props.geometry.coordinates));
                } else if (this.props.geometry.type === "Polygon") {
                    if (this.props.geometry.center && this.props.geometry.radius) {
                        feature.setGeometry(new ol.geom.Circle(this.props.geometry.center, this.props.geometry.radius));
                    } else {
                        feature.setGeometry(new ol.geom.Polygon(this.props.geometry.coordinates));
                    }
                } else if (this.props.geometry.type === "MultiPolygon") {
                    feature.setGeometry(new ol.geom.MultiPolygon(this.props.geometry.coordinates));
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
                className: 'selection-drag-box',
                condition: this.props.drawCondition
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
            if (!typeMap[this.props.geomType]) {
                // Unknown geom type
                return;
            }

            // create an interaction to draw with
            this.drawInteraction = new ol.interaction.Draw({
                stopClick: true,
                source: this.selectionLayer.getSource(),
                condition: this.props.drawCondition,
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

        window.addEventListener('keydown', this.checkModifier);
        window.addEventListener('keyup', this.checkModifier);

        if (this.props.cursor) {
            this.map.getViewport().style.cursor = this.props.cursor;
        }
    };
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
        }
        window.removeEventListener('keydown', this.checkModifier);
        window.removeEventListener('keyup', this.checkModifier);
        this.map.getViewport().style.cursor = '';
    };
    checkModifier = (ev) => {
        const down = ev.type === "keydown";
        this.setState((state) => ({
            modifiers: {
                alt: ev.key === 'Alt' ? down : state.modifiers.alt,
                ctrl: ev.key === 'Control' ? down : state.modifiers.ctrl,
                shift: ev.key === 'Shift' ? down : state.modifiers.shift
            }
        }));
    };
    updateSelectionState = (geometry) => {
        if (!geometry) {
            return;
        }
        const coords = this.props.geomType === 'Circle' ? null : geometry.getCoordinates();

        if (this.props.geomType === "Circle") {
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
        } else {
            this.setState({geometry: {type: this.props.geomType, coordinates: coords}});
        }
    };
    updateMeasurements = (feature) => {
        if (!this.props.measure) {
            return;
        }
        const settings = {
            lenUnit: 'metric',
            areaUnit: 'metric'
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

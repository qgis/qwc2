/**
 * Copyright 2019, norBIT GmbH.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole} from '../../actions/layers';
import FeatureStyles from "../../utils/FeatureStyles";
import IdentifyUtils from '../../utils/IdentifyUtils';
import MapUtils from '../../utils/MapUtils';

class SnapSupport extends React.Component {
    static propTypes = {
        drawing: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapObj: PropTypes.object
    };
    state = {
        mousePos: null
    };
    constructor(props) {
        super(props);
        const geometryFunction = (feature) => {
            if (feature.getGeometry().getType() === "Point") {
                return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
            } else if (feature.getGeometry().getType() === "LineString") {
                return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
            }
            return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
        };
        this.snapSource = new ol.source.Vector();
        this.snapLayer = new ol.layer.Vector({
            source: this.snapSource,
            zIndex: 1000000,
            style: [
                FeatureStyles.interaction( {}, true),
                FeatureStyles.interactionVertex({geometryFunction}, true)
            ]
        });
        this.props.map.addLayer(this.snapLayer);
        this.curPos = null;
    }
    componentDidMount() {
        MapUtils.getHook(MapUtils.ADD_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    componentWillUnmount() {
        MapUtils.getHook(MapUtils.REMOVE_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    componentDidUpdate(prevProps) {
        if (this.props.drawing && this.state.mousePos &&
                (!this.curPos ||
                Math.abs(this.state.mousePos.pixel[0] - this.curPos[0]) > 5 ||
                Math.abs(this.state.mousePos.pixel[1] - this.curPos[1]) > 5)) {
            clearTimeout(this.timeoutId);
            this.curPos = this.state.mousePos.pixel;
            this.timeoutId = setTimeout(() => this.getFeature(), 500);
        } else if (!this.props.drawing && prevProps.drawing) {
            this.reset();
        }
    }
    getMapMousePos = (ev) => {
        this.setState({mousePos: {coordinate: ev.coordinate, pixel: ev.pixel}});
    };
    addSnapFeatures = (geojson) => {
        this.reset();
        const format = new ol.format.GeoJSON();
        const features = format.readFeatures(geojson);
        for (const feature of features) {
            this.snapSource.addFeature(feature);
        }
    };
    addSnapInteraction = () => {
        this.snapInteraction = new ol.interaction.Snap({source: this.snapSource});
        this.props.map.addInteraction(this.snapInteraction);
    };
    getFeature = () => {
        this.timeoutId = null;

        const layers = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        const queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");

        if (!layers || !queryLayers) {
            return;
        }

        const options = {
            info_format: 'text/xml',
            feature_count: 20,
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4
        };

        const request = IdentifyUtils.buildRequest(layers, queryLayers, this.state.mousePos.coordinate, this.props.mapObj, options);
        axios.get(request.url, {params: request.params}).then(response => {
            const results = IdentifyUtils.parseXmlResponse(response.data, this.props.mapObj.projection);
            const features = [];
            results.forEach(result => {
                for (const feature of result) {
                    if (feature.geometry) {
                        feature.id = uuidv4();
                        features.push(feature);
                    }
                }
            });

            if (!features) {
                return;
            }

            const geojson = {
                type: 'FeatureCollection',
                crs: {
                    type: 'name',
                    properties: {
                        name: this.props.mapObj.projection
                    }
                },
                features: features
            };

            this.addSnapFeatures(geojson);
            this.addSnapInteraction();
        });
    };
    reset = () => {
        if (this.snapInteractions) {
            this.props.map.removeInteraction(this.snapInteraction);
        }
        for (const feature of this.snapSource.getFeatures()) {
            this.snapSource.removeFeature(feature);
        }
    };
    render() {
        return null;
    }
}

const selector = (state) => ({
    drawing: ["Redlining", "Measure", "Editing"].includes(state.task.id),
    mapObj: state.map,
    layers: state.layers.flat
});

export default connect(selector, {})(SnapSupport);

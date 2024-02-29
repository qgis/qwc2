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

class SnapSupport extends React.Component {
    static propTypes = {
        drawing: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapObj: PropTypes.object,
        mousepos: PropTypes.object
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
    componentDidUpdate(prevProps) {
        if (prevProps.drawing && this.props.mousepos &&
                (!this.curPos ||
                Math.abs(this.props.mousepos.pixel[0] - this.curPos[0]) > 5 ||
                Math.abs(this.props.mousepos.pixel[1] - this.curPos[1]) > 5)) {
            clearTimeout(this.timeoutId);
            this.curPos = this.props.mousepos.pixel;
            this.timeoutId = setTimeout(() => this.getFeature(), 500);
        } else if (!prevProps) {
            this.reset();
        }
    }
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

        const request = IdentifyUtils.buildRequest(layers, queryLayers, this.props.mousepos.coordinate, this.props.mapObj, options);
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
    drawing: state.task.id === "Redlining" || state.task.id === "Measure" || state.task.id === "Editing" ? true : false,
    mapObj: state.map,
    mousepos: state.mousePosition.position,
    layers: state.layers.flat
});

export default connect(selector, {})(SnapSupport);

/**
 * Copyright 2019, norBIT GmbH.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import ol from 'openlayers';
import uuid from 'uuid';
import {LayerRole} from '../../actions/layers';
import IdentifyUtils from '../../utils/IdentifyUtils';

class SnapSupport extends React.Component {
    static propTypes = {
        drawing: PropTypes.bool,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapObj: PropTypes.object,
        mousepos: PropTypes.object
    }
    constructor(props) {
        super(props);

        const snapStyle = [
            new ol.style.Style({
                fill: new ol.style.Fill({ color: [255, 255, 255, 0.05] }),
                stroke: new ol.style.Stroke({ color: '#3399CC', width: 1})
            }),
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({ color: [255, 255, 255, 0.05] }),
                    stroke: new ol.style.Stroke({color: '#3399CC', width: 1}),
                    points: 4,
                    radius: 5,
                    angle: Math.PI / 4
                }),
                geometry: (feature) => {
                    if (feature.getGeometry().getType() === "Point") {
                        return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                    } else if (feature.getGeometry().getType() === "LineString") {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                    } else {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                    }
                }
            })
        ];
        this.snapSource = new ol.source.Vector();
        this.snapLayer = new ol.layer.Vector({
            source: this.snapSource,
            zIndex: 1000000,
            style: snapStyle
        });
        this.props.map.addLayer(this.snapLayer);
        this.curPos = null;
    }
    componentDidUpdate(prevProps, prevState) {
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
    }
    addSnapInteraction = () => {
        this.snapInteraction = new ol.interaction.Snap({source: this.snapSource});
        this.props.map.addInteraction(this.snapInteraction);
    }
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
            for (const i in results) {
                for (const feature of results[i]) {
                    if (feature.geometry) {
                        feature.id = uuid.v4();
                        features.push(feature);
                    }
                }
            }

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
    }
    reset = () => {
        if (this.snapInteractions) {
            this.props.map.removeInteraction(this.snapInteraction);
        }
        for (const feature of this.snapSource.getFeatures()) {
            this.snapSource.removeFeature(feature);
        }
    }
    render() {
        return null;
    }
}

const selector = (state) => ({
    drawing: state.redlining.geomType || state.measurement.geomType || state.editing.geomType ? true : false,
    mapObj: state.map,
    mousepos: state.mousePosition.position,
    layers: state.layers.flat
});

export default connect(selector, {})(SnapSupport);

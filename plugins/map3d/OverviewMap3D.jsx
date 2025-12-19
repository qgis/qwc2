/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import OlLayer from '../../components/map/OlLayer';
import viewconeIcon from '../../resources/viewcone.svg';

import './style/OverviewMap3D.css';

/**
 * Overview map for the 3D map.
*/
export default class OverviewMap3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        collapsed: true
    };
    constructor(props) {
        super(props);
        this.map = null;
        this.viewConeFeature = new ol.Feature(new ol.geom.Point([0, 0]));
        this.viewConeLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: [this.viewConeFeature]
            }),
            style: (feature) => new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'white'
                }),
                stroke: new ol.style.Stroke({
                    color: 'red',
                    width: 2
                }),
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    src: viewconeIcon,
                    rotation: feature.get('rotation'),
                    scale: 2
                })
            }),
            zIndex: 10000
        });
    }
    componentDidMount() {
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateViewCone);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.mapCrs !== prevProps.sceneContext.mapCrs) {
            this.setupView();
        }
    }
    initOverviewMap = (el) => {
        if (el) {
            this.map = new ol.Map({
                layers: [this.viewConeLayer],
                controls: [],
                target: el
            });
            this.setupView();
        }
    };
    setupView = () => {
        const overviewView = new ol.View({
            enableRotation: false,
            projection: this.props.sceneContext.mapCrs
        });
        this.map.setView(overviewView);
        this.updateViewCone();
    };
    render() {
        const style = {
            display: this.state.collapsed ? 'none' : 'initial'
        };
        const baseLayer = this.props.sceneContext.baseLayers.find(l => l.visibility === true);
        const overviewLayer = this.props.sceneContext.baseLayers.find(l => l.overview === true) ?? baseLayer;
        return [
            (
                <div className="overview-map-3d" key="map3d-overview-map">
                    <div className="ol-overviewmap-map-3d" ref={this.initOverviewMap} style={style} />
                    <button onClick={() => this.setState(state => ({collapsed: !state.collapsed}))} type="button">
                        {this.state.collapsed ? '«' : '»'}
                    </button>
                </div>
            ),
            this.map && overviewLayer ? (
                <OlLayer
                    key={overviewLayer.name} map={this.map}
                    options={{...overviewLayer, visibility: true}} projection={this.props.sceneContext.mapCrs}
                />
            ) : null
        ];
    }
    updateViewCone = () => {
        if (!this.map) {
            return;
        }
        const scene = this.props.sceneContext.scene;
        const x = scene.view.camera.position.x;
        const y = scene.view.camera.position.y;
        const azimuth = scene.view.controls?.getAzimuthalAngle?.() ?? 0;
        const cameraHeight = scene.view.camera.position.z;
        const resolution = cameraHeight / 100;

        this.map.getView().setCenter([x, y]);
        this.map.getView().setResolution(resolution);
        this.viewConeFeature.getGeometry().setCoordinates([x, y]);
        this.viewConeFeature.set('rotation', -azimuth, true);
        this.viewConeLayer.getSource().changed();
    };
}

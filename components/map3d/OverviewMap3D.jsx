/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import ol from 'openlayers';
import PropTypes from 'prop-types';

import OlLayer from '../../components/map/OlLayer';
import viewconeIcon from './img/viewcone.svg';

/**
 * Overview map support for the map component.
*/
export default class OverviewMap3D extends React.Component {
    static propTypes = {
        baseLayer: PropTypes.object,
        sceneContext: PropTypes.object
    };
    state = {
        collapsed: true,
        viewConeLayer: null,
        azimuth: 0,
        center: [0, 0],
        resolution: 1
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
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.mapCrs !== prevProps.sceneContext.mapCrs) {
            this.setupView();
        }
        if (this.map) {
            if (this.state.center !== prevState.center || this.state.azimuth !== prevState.azimuth) {
                this.map.getView().setCenter(this.state.center);
                this.viewConeFeature.getGeometry().setCoordinates(this.state.center);
                this.viewConeFeature.set('rotation', -this.state.azimuth, true);
                this.viewConeLayer.getSource().changed();
            }
            if (this.state.resolution !== prevState.resolution) {
                this.map.getView().setResolution(this.state.resolution);
            }
        }
        if (this.props.sceneContext.scene && this.props.sceneContext.scene !== prevProps.sceneContext.scene) {
            this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateControlsTarget);
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
        overviewView.setResolution(this.state.resolution);
        overviewView.setCenter(this.state.center);
    };
    render() {
        const style = {
            display: this.state.collapsed ? 'none' : 'initial'
        };
        return [
            (
                <div className="overview-map" key="map3d-overview-map">
                    <div className="ol-overviewmap-map" ref={this.initOverviewMap} style={style} />
                    <button onClick={() => this.setState(state => ({collapsed: !state.collapsed}))} type="button">
                        {this.state.collapsed ? '«' : '»'}
                    </button>
                </div>
            ),
            this.map && this.props.baseLayer ? (
                <OlLayer key={this.props.baseLayer.name} map={this.map} options={this.props.baseLayer} projection={this.props.sceneContext.mapCrs} />
            ) : null
        ];
    }
    updateControlsTarget = () => {
        const scene = this.props.sceneContext.scene;
        const x = scene.view.controls.target.x;
        const y = scene.view.controls.target.y;
        const elevationResult = this.props.sceneContext.map.getElevation({coordinates: new Coordinates(this.props.sceneContext.mapCrs, x, y)});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        const terrainHeight = elevationResult.samples[0]?.elevation || 0;
        const cameraHeight = scene.view.camera.position.z;
        // If camera height is at terrain height, target height should be at terrain height
        // If camera height is at twice the terrain height or further, target height should be zero
        const targetHeight = terrainHeight > 0 ? terrainHeight * Math.max(0, 1 - (cameraHeight - terrainHeight) / terrainHeight) : 0;
        scene.view.controls.target.z = targetHeight;
        this.setState({
            center: [x, y],
            resolution: (cameraHeight - terrainHeight) / 200,
            azimuth: scene.view.controls.getAzimuthalAngle()
        });
    };
}

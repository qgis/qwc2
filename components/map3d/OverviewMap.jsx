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
import viewconeIcon from './img/viewcone.svg';

/**
 * Overview map support for the map component.
*/
export default class OverviewMap extends React.Component {
    static propTypes = {
        azimuth: PropTypes.number,
        baseLayer: PropTypes.object,
        center: PropTypes.array,
        projection: PropTypes.string,
        resolution: PropTypes.number
    };
    state = {
        collapsed: true,
        viewConeLayer: null
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
    componentDidUpdate(prevProps) {
        if (this.props.projection !== prevProps.projection) {
            this.setupView();
        }
        if (this.map) {
            if (this.props.center !== prevProps.center || this.props.azimuth !== prevProps.azimuth) {
                this.map.getView().setCenter(this.props.center);
                this.viewConeFeature.getGeometry().setCoordinates(this.props.center);
                this.viewConeFeature.set('rotation', -this.props.azimuth, true);
                this.viewConeLayer.getSource().changed();
            }
            if (this.props.resolution !== prevProps.resolution) {
                this.map.getView().setResolution(this.props.resolution);
            }
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
            projection: this.props.projection
        });
        this.map.setView(overviewView);
        overviewView.setResolution(this.props.resolution);
        overviewView.setCenter(this.props.center);
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
                <OlLayer key={this.props.baseLayer.name} map={this.map} options={this.props.baseLayer} projection={this.props.projection} />
            ) : null
        ];
    }
}

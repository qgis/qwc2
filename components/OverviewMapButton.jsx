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

import viewconeIcon from '../resources/viewcone.svg';
import OlLayer from './map/OlLayer';

import './style/OverviewMapButton.css';


export default class OverviewMapButton extends React.Component {
    static propTypes = {
        center: PropTypes.array,
        coneRotation: PropTypes.number,
        layer: PropTypes.object,
        projection: PropTypes.string,
        resolution: PropTypes.number
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
    componentDidUpdate(prevProps, prevState) {
        if (this.props.projection !== prevProps.projection) {
            this.setupView();
        }
        if (this.map && (
            this.props.center !== prevProps.center ||
            this.props.resolution !== prevProps.resolution ||
            this.props.coneRotation !== prevProps.coneRotation
        )) {
            this.updateViewCone();
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
        this.updateViewCone();
    };
    render() {
        const style = {
            display: this.state.collapsed ? 'none' : 'initial'
        };
        return [
            (
                <div className="overview-map" key="OverivewMap">
                    <div className="ol-overviewmap-map" ref={this.initOverviewMap} style={style} />
                    <button onClick={() => this.setState(state => ({collapsed: !state.collapsed}))} type="button">
                        {this.state.collapsed ? '«' : '»'}
                    </button>
                </div>
            ),
            this.map && this.props.layer ? (
                <OlLayer
                    key={this.props.layer.name} map={this.map}
                    options={{...this.props.layer, visibility: true}} projection={this.props.projection}
                />
            ) : null
        ];
    }
    updateViewCone = () => {
        if (this.props.center) {
            this.map.getView().setCenter(this.props.center);
            this.map.getView().setResolution(this.props.resolution);
            this.viewConeFeature.getGeometry().setCoordinates(this.props.center);
            this.viewConeFeature.set('rotation', this.props.coneRotation, true);
            this.viewConeLayer.getSource().changed();
        }
    };
}

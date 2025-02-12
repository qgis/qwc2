/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../../actions/layers';
import OlLayer from '../../components/map/OlLayer';

import './style/OverviewSupport.css';

/**
 * Overview map support for the map component.
 */
class OverviewMap extends React.Component {
    static propTypes = {
        backgroundLayer: PropTypes.object,
        center: PropTypes.array,
        layers: PropTypes.array,
        map: PropTypes.object,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_OverviewMap-OverviewMap.html) for general options.
         *  Additionally, you can specify:
         *  - `layer`: Custom overview layer, in the same form as background layer definitions (`{type: "<wms|wmts>", "url": ...}`).
         *  - `viewOptions`: Options for the OverviewMap View, see [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_View.html).
         */
        options: PropTypes.object,
        projection: PropTypes.string,
        theme: PropTypes.object,
        themes: PropTypes.object,
        zoom: PropTypes.number
    };
    state = {
        overviewView: null,
        overviewLayer: null
    };
    static defaultProps = {
        options: {}
    };
    constructor(props) {
        super(props);
        this.overview = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme !== prevProps.theme) {
            this.setupView();
        } else if (this.state.overviewView !== prevState.overviewView) {
            const overviewLayerName = (this.props.theme?.backgroundLayers || []).find(entry => entry.overview)?.name;
            let overviewLayer = null;
            if (this.props.options.layer) {
                overviewLayer = {
                    ...this.props.options.layer,
                    visibility: true,
                    id: uuidv1()
                };
                if (overviewLayer.type === 'wms') {
                    overviewLayer.version = overviewLayer.params.VERSION || overviewLayer.version || this.props.themes?.defaultWMSVersion || "1.3.0";
                }
            } else if (overviewLayerName) {
                overviewLayer = this.props.layers.find(l => l.role === LayerRole.BACKGROUND && l.name === overviewLayerName);
                if (overviewLayer) {
                    overviewLayer = {...overviewLayer, visibility: true};
                }
            } else {
                overviewLayer = this.props.backgroundLayer;
            }
            this.setState({overviewLayer: overviewLayer});
        } else if (this.props.backgroundLayer !== prevProps.backgroundLayer) {
            this.setState({overviewLayer: this.props.backgroundLayer});
        }
    }
    initOverviewMap = (el) => {
        if (el) {
            const opt = {
                className: "overview-map",
                collapseLabel: '\u00BB',
                label: '\u00AB',
                collapsed: true,
                collapsible: true,
                ...this.props.options
            };
            delete opt.layer;
            delete opt.viewOptions;

            this.overview = new ol.control.OverviewMap(opt);
            this.overview.setTarget(el);
            this.props.map.addControl(this.overview);
            this.setupView();
        }
    };
    setupView = () => {
        const overviewView = new ol.View({
            projection: this.props.projection,
            ...(this.props.options.viewOptions || {})
        });
        this.overview.getOverviewMap().setView(overviewView);
        overviewView.setZoom(this.props.zoom * 0.8);
        overviewView.setCenter(this.props.center);

        this.setState({overviewView: overviewView, overviewLayer: null});
    };
    componentWillUnmount = () => {
        if (this.overview) {
            this.props.map.removeControl(this.overview);
        }
    };
    render() {
        return [
            (
                <div key="OverviewMap" ref={this.initOverviewMap} />
            ),
            this.state.overviewLayer ? (
                <OlLayer key={this.state.overviewLayer.id} map={this.overview.getOverviewMap()} options={this.state.overviewLayer} projection={this.props.projection} />
            ) : null
        ];
    }
}

export default connect((state) => ({
    theme: state.theme.current,
    themes: state.theme.themes,
    layers: state.layers.flat,
    backgroundLayer: state.layers.flat.find(l => l.role === LayerRole.BACKGROUND && l.visibility),
    projection: state.map.projection,
    center: state.map.center,
    zoom: state.map.zoom
}), {})(OverviewMap);

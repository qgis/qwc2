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

import {LayerRole} from '../../actions/layers';
import OlLayer from '../../components/map/OlLayer';

import './style/OverviewSupport.css';

/**
 * Overview map support for the map component.
 */
class OverviewMap extends React.Component {
    static propTypes = {
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
    constructor(props) {
        super(props);
        const opt = {
            className: "overview-map",
            collapseLabel: '\u00BB',
            label: '\u00AB',
            collapsed: true,
            collapsible: true,
            ...props.options
        };
        delete opt.layer;
        delete opt.viewOptions;

        this.overview = new ol.control.OverviewMap(opt);
        this.overview.getOverviewMap().set('id', 'overview');
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme !== prevProps.theme) {
            const overviewView = new ol.View({
                projection: this.props.projection,
                ...(this.props.options.viewOptions || {})
            });
            this.overview.getOverviewMap().setView(overviewView);
            overviewView.setZoom(this.props.zoom * 0.8);
            overviewView.setCenter(this.props.center);

            this.setState({overviewView: overviewView, overviewLayer: null});
        } else if (this.props.layers !== prevProps.layers || this.state.overviewView !== prevState.overviewView) {
            const overviewLayerName = (this.props.theme?.backgroundLayers || []).find(entry => entry.overview)?.name;
            let overviewLayer = null;
            if (this.props.options.layer) {
                overviewLayer = {
                    ...this.props.options.layer,
                    visibility: true
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
                overviewLayer = this.props.layers.find(l => l.role === LayerRole.BACKGROUND && l.visibility);
            }
            this.setState({overviewLayer: overviewLayer});
        }
    }
    componentDidMount() {
        this.overviewContainer = document.createElement("div");
        this.overviewContainer.id = this.props.map.get('id') + "-overview";
        document.getElementById("PluginsContainer").appendChild(this.overviewContainer);
        this.overview.setTarget(this.props.map.get('id') + "-overview");
        this.props.map.addControl(this.overview);
        this.componentDidUpdate(this.props, {});
    }
    componentWillUnmount = () => {
        document.getElementById("PluginsContainer").removeChild(this.overviewContainer);
    };
    render() {
        if (this.state.overviewLayer) {
            return (
                <OlLayer key={this.state.overviewLayer.uuid} map={this.overview.getOverviewMap()} options={this.state.overviewLayer} projection={this.props.projection} />
            );
        }
        return null;
    }
}

export default connect((state) => ({
    theme: state.theme.current,
    themes: state.theme.themes,
    layers: state.layers.flat,
    projection: state.map.projection,
    center: state.map.center,
    zoom: state.map.zoom
}), {})(OverviewMap);

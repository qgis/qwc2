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
        layers: PropTypes.array,
        map: PropTypes.object,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_OverviewMap-OverviewMap.html) for general options.
         *  Additionally, you can specify:
         *  - `layer: {type: "<wms|wmts>", ...}` to specify a custom overview layer.
         *  - `viewOptions : Options for the OverviewMap View, see [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_View.html).
         */
        options: PropTypes.object,
        projection: PropTypes.string,
        theme: PropTypes.object,
        themes: PropTypes.object,
        /** Options to customize the */
        viewOptions: PropTypes.object
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
        if (this.props.projection !== prevProps.projection) {
            const overviewView = new ol.View({
                projection: this.props.projection,
                ...(this.props.options.viewOptions || {})
            });
            this.overview.getOverviewMap().setView(overviewView);
        }
    }
    componentDidMount() {
        this.overviewContainer = document.createElement("div");
        this.overviewContainer.id = this.props.map.get('id') + "-overview";
        document.getElementById("PluginsContainer").appendChild(this.overviewContainer);
        this.overview.setTarget(this.props.map.get('id') + "-overview");
        this.props.map.addControl(this.overview);
        const overviewView = new ol.View({
            projection: this.props.projection,
            ...(this.props.options.viewOptions || {})
        });
        this.overview.getOverviewMap().setView(overviewView);
    }
    componentWillUnmount = () => {
        document.getElementById("PluginsContainer").removeChild(this.overviewContainer);
    };
    render() {
        const overviewMap = (((this.props.theme || {}).backgroundLayers || []).find(entry => entry.overview) || {}).name;
        let layer = null;
        if (this.props.options.layer) {
            layer = {
                ...this.props.options.layer,
                visibility: true
            };
            if (layer.type === 'wms') {
                layer.version = layer.params.VERSION || layer.version || this.props.themes?.defaultWMSVersion || "1.3.0";
            }
        } else if (overviewMap) {
            layer = this.props.layers.find(l => l.role === LayerRole.BACKGROUND && l.name === overviewMap);
            if (layer) {
                layer = {...layer, visibility: true};
            }
        } else {
            layer = this.props.layers.find(l => l.role === LayerRole.BACKGROUND && l.visibility);
        }
        if (layer) {
            return (
                <OlLayer key={layer.uuid} map={this.overview.getOverviewMap()} options={layer} projection={this.props.projection} />
            );
        }
        return null;
    }
}

export default connect((state) => ({
    theme: state.theme.current,
    themes: state.theme.themes,
    layers: state.layers.flat,
    projection: state.map.projection
}), {})(OverviewMap);

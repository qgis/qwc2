/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole} from '../actions/layers';
import OlLayer from '../components/map/OlLayer';
import MapUtils from '../utils/MapUtils';

import './style/OverviewMap.css';

/**
 * Overview map support for the map component.
 */
class OverviewMap extends React.Component {
    static propTypes = {
        backgroundLayer: PropTypes.object,
        center: PropTypes.array,
        defaultWMSVersion: PropTypes.object,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_OverviewMap-OverviewMap.html) for general options.
         *  Additionally, you can specify:
         *  - `layer`: Custom overview layer, in the same form as background layer definitions (`{type: "<wms|wmts>", "url": ...}`).
         *  - `viewOptions`: Options for the OverviewMap View, see [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_View.html).
         */
        options: PropTypes.object,
        projection: PropTypes.string,
        resolutions: PropTypes.array,
        viewConfigHash: PropTypes.number,
        zoom: PropTypes.number
    };
    static defaultProps = {
        options: {}
    };
    state = {
        overviewView: null,
        overviewLayer: null
    };
    componentWillUnmount = () => {
        if (this.overview) {
            MapUtils.getHook(MapUtils.GET_MAP)?.removeControl?.(this.overview);
        }
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.backgroundLayer !== prevProps.backgroundLayer && !this.props.options.layer) {
            this.setState({overviewLayer: this.props.backgroundLayer});
        }
    }
    initOverviewMap = (el) => {
        if (el) {
            const {layer, viewOptions, ...mapOptions} = this.props.options;
            const overviewView = new ol.View({
                projection: this.props.projection,
                resolutions: this.props.resolutions,
                center: this.props.center,
                zoom: this.props.zoom * 0.8,
                ...viewOptions
            });
            this.overview = new ol.control.OverviewMap({
                view: overviewView,
                className: "overview-map",
                collapseLabel: '\u00BB',
                label: '\u00AB',
                collapsed: true,
                collapsible: true,
                ...mapOptions
            });
            this.overview.setTarget(el);
            MapUtils.getHook(MapUtils.GET_MAP).addControl(this.overview);

            let overviewLayer = null;
            if (layer) {
                overviewLayer = {
                    ...layer,
                    visibility: true,
                    id: uuidv4()
                };
                if (overviewLayer.type === 'wms') {
                    overviewLayer.version = overviewLayer.params.VERSION || overviewLayer.version || this.props.defaultWMSVersion;
                }
            } else {
                overviewLayer = this.props.backgroundLayer;
            }
            this.setState({overviewLayer: overviewLayer, overviewView: overviewView});
        } else if (this.overview) {
            this.setState({overviewLayer: null, overviewView: null});
            MapUtils.getHook(MapUtils.GET_MAP)?.removeControl?.(this.overview);
            this.overview = null;
        }
    };
    render() {
        return (
            <div key={this.props.viewConfigHash} ref={this.initOverviewMap}>
                {this.state.overviewLayer && this.state.overviewView ? (
                    <OlLayer key={this.state.overviewLayer.id} map={this.overview.getOverviewMap()} options={this.state.overviewLayer} projection={this.props.projection} />
                ) : null}
            </div>
        );
    }
}

export default connect((state) => {
    const ovName = (state.theme.current?.backgroundLayers || []).find(entry => entry.overview)?.name;
    const bgLayers = state.layers.flat.filter(
        l => l.role === LayerRole.BACKGROUND && l.type !== "placeholder"
    );
    const backgroundLayer = ovName ? bgLayers.find(l => l.name === ovName) : bgLayers.find(l => l.visibility);
    // Note: the overview map needs to be recreated if projection / resolutions change. So compute a hash of that state
    const viewConfig = {projection: state.map.projection, resolutions: state.map.resolutions};
    const viewConfigHash = JSON.stringify(viewConfig).split('').reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
    return {
        defaultWMSVersion: state.theme.themes?.defaultWMSVersion ?? "1.3.0",
        backgroundLayer: backgroundLayer,
        projection: state.map.projection,
        resolutions: state.map.resolutions,
        center: state.map.center,
        zoom: state.map.zoom,
        viewConfigHash
    };
}, {})(OverviewMap);

/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {LayerRole} from '../actions/layers';
import OlMap from '../components/map/OlMap';
import OlLayer from '../components/map/OlLayer';
import Spinner from '../components/Spinner';
import MapUtils from '../utils/MapUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/Map.css';


class MapPlugin extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        mapOptions: PropTypes.object,
        showLoading: PropTypes.bool,
        swipe: PropTypes.number,
        swipeGeometryTypeBlacklist: PropTypes.array,
        swipeLayerNameBlacklist: PropTypes.array,
        tools: PropTypes.object,
        toolsOptions: PropTypes.object
    }
    static defaultProps = {
        mapOptions: {},
        showLoading: true,
        swipeGeometryTypeBlacklist: [],
        swipeLayerNameBlacklist: [],
        tools: {},
        toolsOptions: {}
    }
    state = {
        renderLayers: [],
        swipeLayer: null
    }
    constructor(props) {
        super(props);
        this.loadingEl = null;
    }
    componentDidUpdate(prevProps) {
        if (this.props.layers !== prevProps.layers || (this.props.swipe !== null) !== (prevProps.swipe !== null)) {
            const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
            const renderLayers = [];

            // Inject external layers
            this.props.layers.slice(0).reverse().forEach((layer) => {
                if (layer.type === "wms" && layer.role === LayerRole.THEME) {
                    const sublayers = layer.params.LAYERS.split(",");
                    const opacities = layer.params.OPACITIES.split(",");
                    const styles = (layer.params.STYLES || "").split(",");
                    for (let i = 0; i < sublayers.length; ++i) {
                        if (layer.externalLayerMap && layer.externalLayerMap[sublayers[i]]) {
                            // Sublayer is mapped to an external layer
                            const sublayer = LayerUtils.searchSubLayer(layer, "name", sublayers[i]);
                            const sublayerVisible = LayerUtils.layerScaleInRange(sublayer, mapScale);
                            if (sublayerVisible) {
                                renderLayers.push({
                                    ...layer.externalLayerMap[sublayers[i]],
                                    params: {
                                        ...layer.params,
                                        ...layer.externalLayerMap[sublayers[i]].params,
                                        OPACITIES: opacities[i],
                                        STYLES: ""
                                    },
                                    opacity: parseInt(opacities[i], 10),
                                    visibility: true
                                });
                            }
                        } else if (renderLayers.length > 0 && renderLayers[renderLayers.length - 1].id === layer.id) {
                            // Compress with previous renderlayer
                            renderLayers[renderLayers.length - 1].params.LAYERS += "," + sublayers[i];
                            renderLayers[renderLayers.length - 1].params.OPACITIES += "," + opacities[i];
                            renderLayers[renderLayers.length - 1].params.STYLES += "," + (styles[i] || "");
                        } else {
                            // Add new renderlayer
                            renderLayers.push({
                                ...layer,
                                uuid: layer.uuid + "-" + i,
                                params: {
                                    ...layer.params,
                                    LAYERS: sublayers[i],
                                    OPACITIES: opacities[i],
                                    STYLES: styles[i] || ""
                                }
                            });
                        }
                    }
                } else {
                    renderLayers.push(layer);
                }
            });

            // Break out swipe layer if necessary
            let swipeLayer = null;
            const swipeLayerNameBlacklist = this.props.swipeLayerNameBlacklist.map(entry => new RegExp('^' + entry.split(/\*+/).map(s => s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')).join('.*') + '$'));
            if (renderLayers.length > 0 && this.props.swipe !== null && renderLayers[renderLayers.length - 1].role > LayerRole.BACKGROUND) {
                // Pick candidate swipe layer according to rules
                for (let i = renderLayers.length - 1; swipeLayer === null && i >= 0; --i) {
                    const layer = renderLayers[i];
                    if (layer.role > LayerRole.USERLAYER) {
                        continue;
                    } else if (layer.type === "wms" && layer.params.LAYERS.split(",").length >= 1) {
                        const paramLayers = layer.params.LAYERS.split(",");
                        const paramOpacities = layer.params.OPACITIES.split(",");
                        const paramStyles = layer.params.STYLES.split(",");
                        for (let j = paramLayers.length - 1; j >= 0; --j) {
                            const layerName = paramLayers[j];
                            if (swipeLayerNameBlacklist.find(entry => layerName.match(entry))) {
                                continue;
                            }
                            const sublayer = LayerUtils.searchSubLayer(layer, "name", layerName);
                            if (sublayer && this.props.swipeGeometryTypeBlacklist.includes((sublayer.geometryType || "").replace(/[ZM]+$/, ""))) {
                                continue;
                            }
                            const newLayers = [];
                            if (j > 0) {
                                newLayers.push({
                                    ...layer,
                                    uuid: layer.uuid + ":0",
                                    params: {
                                        LAYERS: paramLayers.slice(0, j).join(","),
                                        OPACITIES: paramOpacities.slice(0, j).join(","),
                                        STYLES: paramStyles.slice(0, j).join(",")
                                    }
                                });
                            }
                            swipeLayer = {
                                ...layer,
                                uuid: layer.uuid + ":1",
                                params: {
                                    LAYERS: paramLayers[j],
                                    OPACITIES: paramOpacities[j],
                                    STYLES: paramStyles[j]
                                }
                            };
                            newLayers.push(swipeLayer);
                            if (j < paramLayers.length - 1) {
                                newLayers.push({
                                    ...layer,
                                    uuid: layer.uuid + ":2",
                                    params: {
                                        LAYERS: paramLayers.slice(j + 1).join(","),
                                        OPACITIES: paramOpacities.slice(j + 1).join(","),
                                        STYLES: paramStyles.slice(j + 1).join(",")
                                    }
                                });
                            }
                            renderLayers.splice(i, 1, ...newLayers);
                            break;
                        }
                    } else {
                        if (swipeLayerNameBlacklist.find(entry => layer.name.match(entry))) {
                            continue;
                        }
                        if (this.props.swipeGeometryTypeBlacklist.includes((layer.geometryType || "").replace(/[ZM]+$/, ""))) {
                            continue;
                        }
                        swipeLayer = layer;
                    }
                }
            }
            this.setState({renderLayers: renderLayers, swipeLayer: swipeLayer});
        }
    }
    renderLayers = () => {
        let zIndex = 0;
        return this.state.renderLayers.map(layer => {
            if (layer.type === "placeholder") {
                return null;
            }
            ++zIndex;
            const options = {...layer, zIndex: layer.zIndex ?? zIndex};
            const swipe = this.props.swipe !== null && layer === this.state.swipeLayer;
            return (
                <OlLayer key={layer.uuid} options={options} swipe={swipe ? this.props.swipe : null} />
            );
        });
    }
    renderSupportTools = () => {
        return Object.entries(this.props.tools).map(([key, Tool]) => {
            const options = this.props.toolsOptions[key] || {};
            return <Tool key={key} options={options}/>;
        });
    }
    render() {
        let loadingIndicator = null;
        if (this.props.showLoading && this.props.layers.find(layer => layer.loading === true) !== undefined) {
            loadingIndicator = (
                <span className="map-loading-indicator" key="map-loading" ref={el => { this.loadingEl = el; }}>
                    <Spinner className="spinner" />
                    {LocaleUtils.tr("map.loading")}
                </span>
            );
            setTimeout(() => {
                if (this.loadingEl) {
                    this.loadingEl.style.opacity = 1;
                }
            }, 1000);
        }
        return [(
            <OlMap id="map" key="map" mapOptions={this.props.mapOptions} {...this.props.map}>
                {this.renderLayers()}
                {this.renderSupportTools()}
            </OlMap>
        ), loadingIndicator];
    }
}

export default (tools) => {
    return connect((state) => ({
        map: state.map,
        layers: state.layers.flat,
        swipe: state.layers.swipe,
        tools
    }))(MapPlugin);
};

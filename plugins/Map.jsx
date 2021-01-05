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
        tools: PropTypes.object,
        toolsOptions: PropTypes.object
    }
    static defaultProps = {
        mapOptions: {},
        showLoading: true,
        tools: {},
        toolsOptions: {}
    }
    constructor(props) {
        super(props);
        this.loadingEl = null;
    }
    renderLayers = () => {
        const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        let zIndex = 0;
        const renderLayers = [];

        // Inject external layers
        this.props.layers.slice(0).reverse().forEach((layer) => {
            if (layer.type === "wms" && layer.role === LayerRole.THEME) {
                const sublayers = layer.params.LAYERS.split(",");
                const opacities = layer.params.OPACITIES.split(",");
                const styles = (layer.params.STYLES || "").split(",");
                for (let i = 0; i < sublayers.length; ++i) {
                    if (layer.externalLayerMap[sublayers[i]]) {
                        const sublayer = LayerUtils.searchSubLayer(layer, "name", sublayers[i]);
                        const sublayerInvisible = (sublayer.minScale !== undefined && mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && mapScale > sublayer.maxScale);
                        if (!sublayerInvisible) {
                            renderLayers.push({
                                ...layer.externalLayerMap[sublayers[i]],
                                opacity: parseInt(opacities[i], 10),
                                visibility: true
                            });
                        }
                    } else if (renderLayers.length > 0 && renderLayers[renderLayers.length - 1].id === layer.id) {
                        renderLayers[renderLayers.length - 1].params.LAYERS += "," + sublayers[i];
                        renderLayers[renderLayers.length - 1].params.OPACITIES += "," + opacities[i];
                        renderLayers[renderLayers.length - 1].params.STYLES += "," + styles[i] || "";
                    } else {
                        renderLayers.push({
                            ...layer,
                            uuid: layer.uuid + "-" + i, params: {
                                LAYERS: sublayers[i],
                                OPACITIES: opacities[i],
                                STYLES: styles[i] || "",
                                MAP: layer.params.MAP
                            }
                        });
                    }
                }
            } else {
                renderLayers.push(layer);
            }
        });

        // Break out swipe layer if necessary
        if (renderLayers.length > 0 && this.props.swipe !== null && renderLayers[renderLayers.length - 1].role > LayerRole.BACKGROUND) {
            const lastLayer = renderLayers[renderLayers.length - 1];
            if (lastLayer.type === "wms" && lastLayer.params.LAYERS.split(",").length > 1) {
                const paramLayers = lastLayer.params.LAYERS.split(",");
                const paramOpacities = lastLayer.params.OPACITIES.split(",");
                renderLayers[renderLayers.length - 1] = {
                    ...lastLayer,
                    params: {
                        LAYERS: paramLayers.slice(0, -1).join(","),
                        OPACITIES: paramOpacities.slice(0, -1).join(","),
                        MAP: lastLayer.params.MAP
                    }
                };
                renderLayers.push({
                    ...lastLayer,
                    uuid: lastLayer.uuid + ":swipe",
                    params: {
                        LAYERS: paramLayers.slice(-1).join(","),
                        OPACITIES: paramOpacities.slice(-1).join(","),
                        MAP: lastLayer.params.MAP
                    }
                });
            }
        }

        return renderLayers.map(layer => {
            ++zIndex;
            const options = {...layer, zIndex: zIndex};
            const swipe = this.props.swipe !== null && layer === renderLayers[renderLayers.length - 1];
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

/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import assign from 'object-assign';
import Message from '../components/I18N/Message';
import Spinner from '../components/Spinner';
import {LayerRole} from '../actions/layers';
import Map from '../components/map/openlayers/Map';
import Layer from '../components/map/openlayers/Layer';
import MapUtils from '../utils/MapUtils';
import LayerUtils from '../utils/LayerUtils';

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
        const topLayer = (this.props.layers || [])[0];
        let zIndex = 0;
        return this.props.layers.slice(0).reverse().map((layer) => {
            const layers = [];
            if (layer.type === "wms" && layer.role === LayerRole.THEME) {
                const sublayers = layer.params.LAYERS.split(",");
                const opacities = layer.params.OPACITIES.split(",");
                for (let i = 0; i < sublayers.length; ++i) {
                    if (layer.externalLayerMap[sublayers[i]]) {
                        const sublayer = LayerUtils.searchSubLayer(layer, "name", sublayers[i]);
                        const sublayerInvisible = (sublayer.minScale !== undefined && mapScale < sublayer.minScale) || (sublayer.maxScale !== undefined && mapScale > sublayer.maxScale);
                        if (!sublayerInvisible) {
                            layers.push(assign({}, layer.externalLayerMap[sublayers[i]], {
                                opacity: parseInt(opacities[i], 10),
                                visibility: true
                            }));
                        }
                    } else if (layers.length > 0 && layers[layers.length - 1].id === layer.id) {
                        layers[layers.length - 1].params.LAYERS += "," + sublayers[i];
                        layers[layers.length - 1].params.OPACITIES += "," + opacities[i];
                    } else {
                        layers.push(assign({}, layer, {uuid: layer.uuid + "-" + i, params: {
                            LAYERS: sublayers[i],
                            OPACITIES: opacities[i],
                            MAP: layer.params.MAP
                        }}));
                    }
                }
            } else {
                layers.push(layer);
            }
            return layers.map((l) => {
                ++zIndex;
                const options = assign({}, l, {zIndex: zIndex});
                return (
                    <Layer key={l.uuid} options={options} swipe={layer === topLayer ? this.props.swipe : null} />
                );
            });
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
                    <Message msgId="map.loading" />
                </span>
            );
            setTimeout(() => {
                if (this.loadingEl) {
                    this.loadingEl.style.opacity = 1;
                }
            }, 1000);
        }
        return [(
            <Map id="map" key="map" mapOptions={this.props.mapOptions} {...this.props.map}>
                {this.renderLayers()}
                {this.renderSupportTools()}
            </Map>
        ), loadingIndicator];
    }
}

export default (tools) => {
    return connect((state) => ({
        map: state.map,
        layers: state.layers && state.layers.flat || [],
        swipe: state.layers && state.layers.swipe || undefined,
        tools
    }))(MapPlugin);
};

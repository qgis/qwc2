/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import axios from 'axios';
import isEmpty from 'lodash.isempty';
import ConfigUtils from '../utils/ConfigUtils';
import IdentifyUtils from '../utils/IdentifyUtils';
import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import './style/MapTip.css';

class MapTip extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        layerFeatureCount: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapTipsEnabled: PropTypes.bool,
        mousepos: PropTypes.object,
        removeLayer: PropTypes.func,
        theme: PropTypes.object
    }
    static defaultProps = {
        layerFeatureCount: 5
    }
    state = {
        maptips: [],
        pos: null
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.mapTipsEnabled && this.props.mousepos &&
            this.props.mousepos !== prevProps.mousepos &&
            (
                isEmpty(this.state.pos) ||
                Math.abs(this.props.mousepos.pixel[0] - this.state.pos[0]) > 5 ||
                Math.abs(this.props.mousepos.pixel[1] - this.state.pos[1]) > 5
            )
        ) {
            this.clearMaptip();
            const pos = this.props.mousepos.pixel;
            this.setState({pos});
            this.timeoutId = setTimeout(() => this.queryMapTip(), 500);
        } else if (!this.props.mapTipsEnabled && prevProps.mapTipsEnabled) {
            this.clearMaptip();
        }
    }
    clearMaptip = () => {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        if (!isEmpty(this.state.maptips)) {
            this.props.removeLayer('maptipselection');
        }
        this.setState({maptips: [], pos: null});
    }
    queryMapTip = () => {
        this.timeoutId = null;
        const options = {
            info_format: 'text/xml',
            feature_count: this.props.layerFeatureCount,
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4,
            with_maptip: true,
            with_htmlcontent: false
        };
        const layer = this.props.layers.find(l => l.role === LayerRole.THEME);
        let queryLayers = this.props.layers.reduce((accum, l) => {
            return l.role === LayerRole.THEME ? accum.concat(l.queryLayers) : accum;
        }, []).join(",");
        if (!layer || !queryLayers) {
            return;
        }
        if (!ConfigUtils.getConfigProp("allowReorderingLayers", this.props.theme) && layer.drawingOrder) {
            queryLayers = layer.drawingOrder.slice(0).reverse().filter(entry => layer.queryLayers.includes(entry)).join(",");
        }

        const request = IdentifyUtils.buildRequest(layer, queryLayers, this.props.mousepos.coordinate, this.props.map, options);

        axios.get(request.url, {params: request.params}).then(response => {
            const mapTips = [];
            const result = IdentifyUtils.parseXmlResponse(response.data, this.props.map.projection);
            const features = [];
            for (const layerName of request.params.layers.split(",")) {
                for (const feature of result[layerName] || []) {
                    if (feature.properties.maptip) {
                        features.push(feature);
                        mapTips.push(feature.properties.maptip);
                    }
                }
            }
            if (!isEmpty(features)) {
                const sellayer = {
                    id: "maptipselection",
                    role: LayerRole.SELECTION
                };
                this.props.addLayerFeatures(sellayer, features, true);
            }
            this.setState({maptips: mapTips});
        });
    }
    render() {
        if (!isEmpty(this.state.maptips) && this.state.pos) {
            // Render off-screen first to measure dimensions, then place as necessary
            const position = {
                left: 10000 + "px",
                top: 10000 + "px"
            };
            const bufferPos = {
                left: (this.state.pos[0] - 8) + "px",
                top: (this.state.pos[1] - 8) + "px"
            };
            return [(
                <div id="MapTipPointerBuffer" key="MapTipPointerBuffer" style={bufferPos} />
            ), (
                <div
                    id="MapTip" key="MapTip"
                    ref={this.positionMapTip}
                    style={position}>
                    {this.state.maptips.map((maptip, idx) => (
                        <div dangerouslySetInnerHTML={{__html: maptip}} key={"tip" + idx} />
                    ))}
                </div>
            )];
        }
        return null;
    }
    positionMapTip = (el) => {
        if (el) {
            let x = this.state.pos[0];
            let y = this.state.pos[1];
            const bbox = el.getBoundingClientRect();
            if (x + bbox.width > window.innerWidth) {
                x -= bbox.width;
            }
            if (y + bbox.height > window.innerHeight) {
                y -= bbox.height;
            }
            el.style.left = x + "px";
            el.style.top = y + "px";
        }
    }
}


const selector = (state) => ({
    mapTipsEnabled: state.map.maptips && state.identify.tool !== null,
    theme: state.theme.current || {},
    layers: state.layers.flat,
    mousepos: state.mousePosition.position,
    map: state.map
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer
})(MapTip);

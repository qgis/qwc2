/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import htmlReactParser, {domToReact} from 'html-react-parser';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {openExternalUrl} from '../actions/windows';
import {MapContainerPortalContext} from '../components/PluginsContainer';
import IdentifyUtils from '../utils/IdentifyUtils';
import MapUtils from '../utils/MapUtils';

import './style/MapTip.css';

/**
 * Displays maptips by hovering over features on the map.
 *
 * Queries the map tips configured in the QGIS layer properites over GetFeatureInfo.
 *
 * The map tip needs to be configured in QGIS Layer Properties &rarr; Display.
 */
class MapTip extends React.Component {
    static contextType = MapContainerPortalContext;

    static propTypes = {
        addLayerFeatures: PropTypes.func,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        /** The maximum number of feature maptips to display for a single layer. */
        layerFeatureCount: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapTipsEnabled: PropTypes.bool,
        /** The maximum height of the maptip popop bubble, as a CSS string. */
        maxHeight: PropTypes.string,
        /** The maximum height of the maptip popop bubble, as a CSS string. */
        maxWidth: PropTypes.string,
        openExternalUrl: PropTypes.func,
        removeLayer: PropTypes.func,
        /** Whether to show the maptip feature selection on the map or not */
        showFeatureSelection: PropTypes.bool
    };
    static defaultProps = {
        layerFeatureCount: 5,
        maxHeight: "15em",
        maxWidth: "20em",
        showFeatureSelection: true
    };
    state = {
        maptips: {},
        maptipsLayerOrder: [],
        mousePos: null,
        pos: null
    };
    componentDidMount() {
        MapUtils.getHook(MapUtils.ADD_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    componentWillUnmount() {
        MapUtils.getHook(MapUtils.REMOVE_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.map !== prevProps.map) {
            this.clearMaptip();
        }
        if (this.props.mapTipsEnabled && this.state.mousePos &&
            this.state.mousePos !== prevState.mousePos &&
            (
                isEmpty(this.state.pos) ||
                Math.abs(this.state.mousePos.pixel[0] - this.state.pos[0]) > 5 ||
                Math.abs(this.state.mousePos.pixel[1] - this.state.pos[1]) > 5
            )
        ) {
            this.timeoutId = setTimeout(() => this.queryMapTip(this.state.mousePos.pixel), 500);
        } else if (!this.props.mapTipsEnabled && prevProps.mapTipsEnabled) {
            this.clearMaptip();
        }
    }
    getMapMousePos = (ev) => {
        this.clearMaptip();
        clearTimeout(this.mouseStateTimeout);
        this.mouseStateTimeout = setTimeout(() => {
            this.setState({mousePos: {coordinate: ev.coordinate, pixel: ev.pixel}});
        }, 100);
    };
    clearMaptip = () => {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        if (this.state.pos) {
            this.props.removeLayer('maptipselection');
            this.setState({maptips: {}, maptipsOrder: [], pos: null});
        }
    };
    queryMapTip = (pos) => {
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
        const reqId = uuidv1();
        this.reqId = reqId;
        const layerOrder = [];
        this.props.layers.forEach(layer => {
            if (
                !(layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) ||
                !(layer.infoFormats || []).includes("text/xml") || isEmpty(layer.queryLayers)
            ) {
                return;
            }
            let queryLayers = layer.queryLayers;
            if (!isEmpty(layer.drawingOrder)) {
                queryLayers = layer.drawingOrder.slice(0).reverse().filter(entry => layer.queryLayers.includes(entry));
            }
            layerOrder.push(layer.id);
            const request = IdentifyUtils.buildRequest(layer, queryLayers.join(","), this.state.mousePos.coordinate, this.props.map, options);
            IdentifyUtils.sendRequest(request, (response) => {
                if (this.reqId === reqId) {
                    const result = IdentifyUtils.parseXmlResponse(response || "", this.props.map.projection, layer);
                    const mapTips = [];
                    const features = [];
                    for (const sublayer of request.params.layers.split(",")) {
                        const sublayerFeatures = (result[sublayer] || []).filter(feature => feature.properties.maptip);
                        features.push(...sublayerFeatures);
                        mapTips.push(...sublayerFeatures.map(feature => feature.properties.maptip));
                    }
                    if (this.props.showFeatureSelection && !isEmpty(features)) {
                        const sellayer = {
                            id: "maptipselection",
                            role: LayerRole.SELECTION
                        };
                        this.props.addLayerFeatures(sellayer, features, true);
                    }
                    this.setState((state) => ({
                        pos: pos,
                        maptips: {...state.maptips, [layer.id]: mapTips}
                    }));
                }
            });
        });
        this.setState({maptipsLayerOrder: layerOrder});
    };
    render() {
        if (!isEmpty(this.state.maptips) && this.state.pos) {
            // Render off-screen first to measure dimensions, then place as necessary
            const style = {
                left: 10000 + "px",
                top: 10000 + "px",
                maxHeight: this.props.maxHeight,
                maxWidth: this.props.maxWidth
            };
            const bufferPos = {
                left: (this.state.pos[0] - 8) + "px",
                top: (this.state.pos[1] - 8) + "px"
            };
            return ReactDOM.createPortal([(
                <div id="MapTipPointerBuffer" key="MapTipPointerBuffer" style={bufferPos} />
            ), (
                <div
                    id="MapTip" key="MapTip"
                    ref={this.positionMapTip}
                    style={style}>
                    {this.state.maptipsLayerOrder.map(key => this.state.maptips[key] || []).flat().map((maptip, idx) => (
                        <div key={idx}>
                            {this.parsedContent(maptip)}
                        </div>
                    ))}
                </div>
            )], this.context);
        }
        return null;
    }
    parsedContent = (text) => {
        const options = {replace: (node) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} onClick={node.attribs.onclick ? (ev) => this.evalOnClick(ev, node.attribs.onclick) : this.attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {domToReact(node.children, options)}
                    </a>
                );
            }
            return undefined;
        }};
        return htmlReactParser(text, options);
    };
    evalOnClick = (ev, onclick) => {
        // eslint-disable-next-line
        eval(onclick);
        ev.preventDefault();
    };
    attributeLinkClicked = (ev) => {
        this.props.openExternalUrl(ev.target.href, ev.target.target, {docked: this.props.iframeDialogsInitiallyDocked});
        ev.preventDefault();
    };
    positionMapTip = (el) => {
        if (el) {
            let x = this.state.pos[0];
            let y = this.state.pos[1];
            const parentBBox = el.parentElement.getBoundingClientRect();
            const bbox = el.getBoundingClientRect();
            if (x + bbox.width > parentBBox.width) {
                x -= bbox.width;
            }
            if (y + bbox.height > parentBBox.height) {
                y -= bbox.height;
            }
            el.style.left = x + "px";
            el.style.top = y + "px";
        }
    };
}

export default connect((state) => ({
    mapTipsEnabled: state.map.maptips && state.task.identifyEnabled,
    layers: state.layers.flat,
    map: state.map
}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    openExternalUrl: openExternalUrl
})(MapTip);

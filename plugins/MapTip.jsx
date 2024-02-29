/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import htmlReactParser, {domToReact} from 'html-react-parser';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {openExternalUrl} from '../actions/task';
import ConfigUtils from '../utils/ConfigUtils';
import IdentifyUtils from '../utils/IdentifyUtils';

import './style/MapTip.css';

/**
 * Displays maptips by hovering over features on the map.
 *
 * Queries the map tips configured in the QGIS layer properites over GetFeatureInfo.
 *
 * The map tip needs to be configured in QGIS Layer Properties &rarr; Display.
 */
class MapTip extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        iframeDialogsInitiallyDocked: PropTypes.bool,
        /** The maximum number of feature maptips to display for a single layer. */
        layerFeatureCount: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
        mapTipsEnabled: PropTypes.bool,
        /* The maximum height of the maptip popop bubble, as a CSS string. */
        maxHeight: PropTypes.string,
        /* The maximum height of the maptip popop bubble, as a CSS string. */
        maxWidth: PropTypes.string,
        mousepos: PropTypes.object,
        openExternalUrl: PropTypes.func,
        removeLayer: PropTypes.func,
        /** Whether to show the maptip feature selection on the map or not */
        showFeatureSelection: PropTypes.bool,
        theme: PropTypes.object
    };
    static defaultProps = {
        layerFeatureCount: 5,
        maxHeight: "15em",
        maxWidth: "20em",
        showFeatureSelection: true
    };
    state = {
        reqId: null,
        maptips: [],
        pos: null
    };
    componentDidUpdate(prevProps) {
        if (this.props.map !== prevProps.map || this.props.theme !== prevProps.theme) {
            this.clearMaptip();
        }
        if (this.props.mapTipsEnabled && this.props.mousepos &&
            this.props.mousepos !== prevProps.mousepos &&
            (
                isEmpty(this.state.pos) ||
                Math.abs(this.props.mousepos.pixel[0] - this.state.pos[0]) > 5 ||
                Math.abs(this.props.mousepos.pixel[1] - this.state.pos[1]) > 5
            )
        ) {
            this.clearMaptip();
            this.timeoutId = setTimeout(() => this.queryMapTip(this.props.mousepos.pixel), 500);
        } else if (!this.props.mapTipsEnabled && prevProps.mapTipsEnabled) {
            this.clearMaptip();
        }
    }
    clearMaptip = () => {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        if (this.state.pos) {
            this.props.removeLayer('maptipselection');
            this.setState({maptips: [], pos: null, reqId: null});
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
        const reqId = uuidv1();
        this.setState({reqId: reqId});

        const request = IdentifyUtils.buildRequest(layer, queryLayers, this.props.mousepos.coordinate, this.props.map, options);
        IdentifyUtils.sendRequest(request, (response) => {
            if (this.state.reqId === reqId) {
                const mapTips = [];
                const features = [];
                if (response) {
                    const result = IdentifyUtils.parseXmlResponse(response, this.props.map.projection);
                    for (const layerName of request.params.layers.split(",")) {
                        for (const feature of result[layerName] || []) {
                            if (feature.properties.maptip) {
                                features.push(feature);
                                mapTips.push(feature.properties.maptip);
                            }
                        }
                    }
                }
                if (this.props.showFeatureSelection && !isEmpty(features)) {
                    const sellayer = {
                        id: "maptipselection",
                        role: LayerRole.SELECTION
                    };
                    this.props.addLayerFeatures(sellayer, features, true);
                }
                this.setState({pos: pos, maptips: mapTips, reqId: null});
            }
        });
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
            return [(
                <div className="MapTipPointerBufferr" key="MapTipPointerBuffer" style={bufferPos} />
            ), (
                <div
                    id="MapTip" key="MapTip"
                    ref={this.positionMapTip}
                    style={style}>
                    {this.state.maptips.map((maptip, idx) => (
                        <div key={"tip" + idx}>
                            {this.parsedContent(maptip)}
                        </div>
                    ))}
                </div>
            )];
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
    };
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
    removeLayer: removeLayer,
    openExternalUrl: openExternalUrl
})(MapTip);

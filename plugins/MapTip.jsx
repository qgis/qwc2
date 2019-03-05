/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const axios = require('axios');
const uuid = require('uuid');
const ConfigUtils = require("../utils/ConfigUtils");
const IdentifyUtils = require('../utils/IdentifyUtils');
const ThemeUtils = require('../utils/ThemeUtils');
const {LayerRole, addLayerFeatures, removeLayer} = require('../actions/layers');
require('./style/MapTip.css');

class MapTip extends React.Component {
    static propTypes = {
        mapTipsEnabled: PropTypes.bool,
        theme: PropTypes.object,
        layers: PropTypes.array,
        mousepos: PropTypes.object,
        map: PropTypes.object,
        addLayer: PropTypes.func,
        removeLayer: PropTypes.func,
    }
    state = {
        maptip: null,
        pos: null
    }
    componentDidMount() {
        this.curPos = null;
        // Hide / abort map tip query if mouse leaves canvas
        let mapEl = document.getElementById("map");
        if(mapEl) {
            mapEl.addEventListener("mouseout", (ev) => {
                if(!ev.relatedTarget || ev.relatedTarget.id != "MapTip") {
                    this.clearMaptip();
                }
            }, false);
        }
    }
    componentWillReceiveProps(newProps) {
        if(newProps.mapTipsEnabled && newProps.mousepos && (
            !this.curPos ||
            Math.abs(newProps.mousepos.pixel[0] - this.curPos[0]) > 5 ||
            Math.abs(newProps.mousepos.pixel[1] - this.curPos[1]) > 5
        )) {
            this.clearMaptip();
            this.curPos = newProps.mousepos.pixel;
            this.timeoutId = setTimeout(() => this.queryMapTip(this.curPos[0], this.curPos[1]), 500);
        } else if(!newProps.mapTipsEnabled && this.props.mapTipsEnabled) {
            this.clearMaptip();
        }
    }
    clearMaptip = () => {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        if(this.state.maptip) {
            this.props.removeLayer('maptipselection');
        }
        this.setState({maptip: null, pos: null});
    }
    queryMapTip = (x, y) => {
        this.timeoutId = null;
        let options = {
            info_format: 'text/xml',
            feature_count: 1,
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4,
            with_maptip: true
        };
        let layer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        let queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");
        if(!layer || !queryLayers) {
            return;
        }
        if(!ThemeUtils.layerReorderingAllowed(this.props.theme) && layer.drawingOrder) {
            queryLayers = layer.drawingOrder.slice(0).reverse().filter(entry => layer.queryLayers.includes(entry)).join(",");
        }

        let request = IdentifyUtils.buildRequest(layer, queryLayers, this.props.mousepos.coordinate, this.props.map, options);

        axios.get(request.url, {params: request.params}).then(response => {
            let mapTip = null;
            let result = IdentifyUtils.parseXmlResponse({data: response.data, request}, this.props.map.projection);
            for(let layerName of request.params.layers.split(",")) {
                if(result[layerName]) {
                    let feature = result[layerName].find(feature => feature.properties.maptip);
                    if(feature) {
                        const layer = {
                            id: "maptipselection",
                            role: LayerRole.SELECTION
                        };
                        this.props.addLayerFeatures(layer, [feature], true);
                        mapTip = feature.properties.maptip;
                        break;
                    }
                }
            }
            this.setState({maptip: mapTip, pos: [x, y]});
        });
    }
    render() {
        if(this.state.maptip && this.state.pos) {
            // Render off-screen first to measure dimensions, then place as necessary
            let position = {
                left: 10000 + "px",
                top: 10000 + "px"
            };
            let x = this.state.pos[0];
            let y = this.state.pos[1];
            return (
                <div
                    ref={el => {
                        if(el) {
                            let bbox = el.getBoundingClientRect();
                            if(x + bbox.width > window.innerWidth) {
                                x -= bbox.width;
                            }
                            if(y + bbox.height > window.innerHeight) {
                                y -= bbox.height;
                            }
                            el.style.left = x + "px";
                            el.style.top = y + "px";
                        }
                    }}
                    id="MapTip"
                    style={position}
                    dangerouslySetInnerHTML={{__html: this.state.maptip}}>
                </div>
            )
        }
        return null;
    }
};


const selector = (state) => ({
    mapTipsEnabled: state.map && state.map.maptips && state.identify.enabled,
    theme: state.theme && state.theme.current || {},
    layers: state.layers && state.layers.flat ? state.layers.flat : null,
    mousepos: state.mousePosition ? state.mousePosition.position : undefined,
    map: state.map ? state.map : null
});

module.exports = {
    MapTipPlugin: connect(selector, {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
    })(MapTip),
    reducers: {
        mousePosition: require('../reducers/mousePosition')
    }
}

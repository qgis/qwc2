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
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const IdentifyUtils = require('../utils/IdentifyUtils');
const {LayerRole, addLayerFeatures, removeLayer} = require('../actions/layers');
require('./style/MapTip.css');

class MapTip extends React.Component {
    static propTypes = {
        mapTipsEnabled: PropTypes.bool,
        layers: PropTypes.array,
        mousepos: PropTypes.object,
        map: PropTypes.object,
        addLayer: PropTypes.func,
        removeLayer: PropTypes.func,
    }
    state = {
        maptip: null
    }
    componentWillReceiveProps(newProps) {
        if(this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        let maptip = this.state.maptip;
        if(this.props.mousepos !== newProps.mousepos && newProps.mapTipsEnabled) {
            this.timeoutId = setTimeout(this.queryMapTip, 500);
            if(maptip) {
                this.props.removeLayer('maptipselection');
            }
            maptip = null;
        } else if(!newProps.mapTipsEnabled && maptip) {
            maptip = null;
            this.props.removeLayer('maptipselection');
        }
        this.setState({maptip: maptip});
    }
    queryMapTip = () => {
        this.timeoutId = null;
        let options = {
            info_format: 'text/xml',
            feature_count: 1,
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4
        };
        let layer = this.props.layers.find(layer => layer.isThemeLayer);
        let queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.isThemeLayer ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");
        if(!layer || !queryLayers) {
            return;
        }
        let request = IdentifyUtils.buildRequest(layer, queryLayers, this.props.mousepos.coordinate, this.props.map, options);

        axios.get(request.url, {params: request.params}).then(response => {
            let result = IdentifyUtils.parseXmlResponse({data: response.data, request}, this.props.map.projection);
            let layers = Object.keys(result);
            for(let i = 0; i < layers.length; ++i) {
                let feature = result[layers[i]].find(feature => feature.properties.maptip);
                if(feature) {
                    const layer = {
                        id: "maptipselection",
                        role: LayerRole.SELECTION
                    };
                    this.props.addLayerFeatures(layer, [feature], true);
                    this.setState({maptip: feature.properties.maptip});
                    break;
                }
            }
        });
    }
    render() {
        if(this.state.maptip && this.props.mousepos) {
            let position = {
                left: this.props.mousepos.pixel[0],
                top: this.props.mousepos.pixel[1]
            };
            return (
                <div
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
    mapTipsEnabled: state.map && state.map.maptips,
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

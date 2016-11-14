/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const axios = require('axios');
const uuid = require('node-uuid');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const MapInfoUtils = require("../../MapStore2/web/client/utils/MapInfoUtils");
const IdentifyUtils = require('../utils/IdentifyUtils');
const {addLayer, removeLayer} = require('../../MapStore2/web/client/actions/layers');
require('./style/MapTip.css');

const MapTip = React.createClass({
    propTypes: {
        mapTipsEnabled: React.PropTypes.bool,
        layerid: React.PropTypes.string,
        layers: React.PropTypes.array,
        mousepos: React.PropTypes.object,
        map: React.PropTypes.object,
        addLayer: React.PropTypes.func,
        removeLayer: React.PropTypes.func,
    },
    getInitialState(){
        return {maptip: null, layer: null};
    },
    componentWillReceiveProps(newProps) {
        if(this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        let layer = this.state.layer;
        let maptip = this.state.maptip;
        if(this.props.layerid !== newProps.layerid || (!layer && newProps.layerid)) {
            if(newProps.layers && newProps.layerid) {
                layer = newProps.layers.find(item => item.id === newProps.layerid)
            } else {
                layer = null;
            }
        }
        if(this.props.mousepos !== newProps.mousepos && layer && newProps.mapTipsEnabled) {
            this.timeoutId = setTimeout(this.queryMapTip, 500);
            if(maptip) {
                this.props.removeLayer('maptipselection');
            }
            maptip = null;
        } else if(!newProps.mapTipsEnabled && maptip) {
            maptip = null;
            this.props.removeLayer('maptipselection');
        }
        this.setState({layer: layer, maptip: maptip});
    },
    queryMapTip() {
        this.timeoutId = null;
        let props = {
            map: this.props.map,
            point: {
                latlng: {
                    lat: this.props.mousepos.y,
                    lng: this.props.mousepos.x
                }
            },
            maxItems: 1
        };
        let {url, request, metadata} = MapInfoUtils.buildIdentifyWMSRequest(this.state.layer, props);

        const baseParams = {
            service: 'WMS',
            version: '1.1.1',
            request: 'GetFeatureInfo'
        };
        const params = assign({}, baseParams, request, {
            info_format: 'application/vnd.ogc.gml',
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4
        });
        const reqId = uuid.v1();
        axios.get(url, {params: params}).then(response => {
            let stats = {count: 0, lastFeature: null};
            IdentifyUtils.parseGmlResponse(response.data, stats);
            if(stats.count === 1) {
                let mapTips = stats.lastFeature.getElementsByTagName("qgs:maptip");
                if(mapTips.length === 0) {
                    mapTips = stats.lastFeature.getElementsByTagName("maptip");
                }
                if(mapTips.length > 0) {
                    let layer = {
                        id: 'maptipselection',
                        name: 'maptipselection',
                        title: 'Maptip selecton',
                        type: "vector",
                        features: IdentifyUtils.gmlFeatureGeometryAsGeoJson(stats.lastFeature),
                        featuresCrs: "EPSG:3857",
                        visibility: true
                    };
                    this.props.addLayer(layer, true);
                    this.setState({maptip: mapTips[0].textContent});
                }
            }
        });
    },
    render() {
        if(this.state.maptip && this.props.mousepos) {
            let position = {
                left: this.props.mousepos.pixel.x,
                top: this.props.mousepos.pixel.y
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
});


const selector = (state) => ({
    mapTipsEnabled: state.layertree && state.layertree.maptips,
    layerid: state.theme ? state.theme.currentlayer : null,
    layers: state.layers && state.layers.flat ? state.layers.flat : null,
    mousepos: state.mousePosition ? state.mousePosition.position : undefined,
    map: state.map ? state.map.present : null
});

module.exports = {
    MapTipPlugin: connect(selector, {
        addLayer: addLayer,
        removeLayer: removeLayer,
    })(MapTip),
    reducers: {
        mousePosition: require('../../MapStore2/web/client/reducers/mousePosition')
    }
}

/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Message = require('../components/I18N/Message');
const Spinner = require('../components/Spinner');
const {LayerRole} = require('../actions/layers');

const {Map, Layer} = require('./map/MapComponents');

require('./style/Map.css');


class MapPlugin extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        layers: PropTypes.array,
        swipe: PropTypes.number,
        tools: PropTypes.object,
        toolsOptions: PropTypes.object,
        showLoading: PropTypes.bool,
        mapOptions: PropTypes.object
    }
    static defaultProps = {
        tools: {},
        toolsOptions: {},
        showLoading: true,
        mapOptions: {}
    }
    constructor(props) {
        super(props);
        this.loadingEl = null;
    }
    renderLayers = () => {
        const projection = this.props.map.projection || 'EPSG:3857';
        const topLayer = (this.props.layers || [])[0];
        return this.props.layers.slice(0).reverse().map((layer, index) => {
            let layers = [];
            if(layer.type === "wms" && layer.role === LayerRole.THEME) {
                let sublayers = layer.params.LAYERS.split(",");
                let opacities = layer.params.OPACITIES.split(",");
                for(let i = 0; i < sublayers.length; ++i) {
                    if(layer.externalLayers[sublayers[i]]) {
                        layers.push(assign({}, layer.externalLayers[sublayers[i]], {
                            opacity: opacities[i]
                        }));
                    } else if(layers.length > 0 && layers[layers.length - 1].id === layer.id) {
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
            return layers.map((l, i) => (
                <Layer key={l.uuid} swipe={layer === topLayer ? this.props.swipe : null} type={l.type} srs={projection} zIndex={l.zIndex || (index * this.props.layers.length + i)} options={l} />
            ));
        });
    }
    renderSupportTools = () => {
        return Object.keys(this.props.tools).map((tool) => {
            const Tool = this.props.tools[tool];
            const options = this.props.toolsOptions[tool] || {};
            return <Tool key={tool} options={options}/>;
        });
    }
    render() {
        if (this.props.map) {
            let loadingIndicator = null;
            if(this.props.showLoading && this.props.layers.find(layer => layer.loading === true) != undefined){
                loadingIndicator = (
                <span ref={el => this.loadingEl = el} className="map-loading-indicator" key="map-loading">
                    <Spinner className="spinner" />
                    <Message msgId="map.loading" />
                </span>);
                setTimeout(() => {
                    if(this.loadingEl) {
                        this.loadingEl.style.opacity = 1;
                    }
                }, 1000);
            }
            return [(
                <Map id="map" key="map"
                    mapOptions={this.props.mapOptions}
                    {...this.props.map}
                    zoomControl={false}>
                    {this.renderLayers()}
                    {this.renderSupportTools()}
                </Map>
            ), loadingIndicator];
        }
        return null;
    }
};

module.exports = (tools) => { return {
    MapPlugin: connect((state) => ({
        map: state.map,
        layers: state.layers && state.layers.flat || [],
        swipe: state.layers && state.layers.swipe || undefined,
        tools
    }))(MapPlugin)
}};

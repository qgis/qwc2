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
const Message = require('../../MapStore2Components/components/I18N/Message');
const Spinner = require('../components/Spinner');

const MapComponents = require('./map/MapComponents');

require('./style/Map.css');


class MapPlugin extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        layers: PropTypes.array,
        swipe: PropTypes.number,
        tools: PropTypes.object,
        toolsOptions: PropTypes.object,
        showLoading: PropTypes.bool
    }
    static defaultProps = {
        tools: {},
        toolsOptions: {},
        showLoading: true
    }
    constructor(props) {
        super(props);
        this.loadingEl = null;
    }
    renderLayerContent = (layer, layerCrs) => {
        if (layer.features && layer.type === "vector") {
            return layer.features.map( (feature) => {
                return (
                    <MapComponents.Feature
                        key={feature.id}
                        type={feature.type || "Feature"}
                        geometry={feature.geometry}
                        properties={feature.properties}
                        featureId={feature.id}
                        crs={feature.crs || layerCrs}
                        layerCrs={layerCrs}
                        styleName={feature.styleName || null}
                        styleOptions={feature.styleOptions || {}}/>
                );
            });
        }
        return null;
    }
    renderLayers = () => {
        const projection = this.props.map.projection || 'EPSG:3857';
        const topLayer = (this.props.layers || [])[0];
        return this.props.layers.slice(0).reverse().map((layer, index) => {
            return (
                <MapComponents.Layer swipe={layer === topLayer ? this.props.swipe : null} type={layer.type} srs={projection} zIndex={layer.zIndex || index} key={layer.uuid} options={layer}>
                    {this.renderLayerContent(layer, projection)}
                </MapComponents.Layer>
            );
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
            let mapOptions = {
                controls: {
                    attributionOptions: {
                        collapsible: false
                    }
                }
            };
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
                <MapComponents.Map id="map" key="map"
                    mapOptions={mapOptions}
                    {...this.props.map}
                    zoomControl={false}>
                    {this.renderLayers()}
                    {this.renderSupportTools()}
                </MapComponents.Map>
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

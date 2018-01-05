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

const MapComponents = require('./map/MapComponents');

require('./style/Map.css');


class MapPlugin extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        layers: PropTypes.array,
        projection: PropTypes.string,
        maxExtent: PropTypes.array,
        tools: PropTypes.object,
        toolsOptions: PropTypes.object
    }
    static defaultProps = {
        projection: "EPSG:3857",
        tools: {},
        toolsOptions: {}
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
                <MapComponents.Layer swipe={layer === topLayer ? this.props.map.swipe : null} type={layer.type} srs={projection} position={index} key={layer.uuid} options={layer}>
                    {this.renderLayerContent(layer, projection)}
                </MapComponents.Layer>
            );
        });
    }
    renderSupportTools = () => {
        return Object.keys(this.props.tools).map((tool) => {
            const Tool = this.props.tools[tool];
            const options = this.props.toolsOptions[tool] || {};
            return <Tool key={tool} {...options}/>;
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
            return (
                <MapComponents.Map id="map"
                    mapOptions={mapOptions}
                    projection={this.props.projection}
                    maxExtent={this.props.maxExtent}
                    {...this.props.map}
                    zoomControl={false}>
                    {this.renderLayers()}
                    {this.renderSupportTools()}
                </MapComponents.Map>
            );
        }
        return null;
    }
};

module.exports = (tools) => { return {
    MapPlugin: connect((state) => ({
        map: state.map,
        layers: state.layers && state.layers.flat || [],
        tools
    }))(MapPlugin)
}};

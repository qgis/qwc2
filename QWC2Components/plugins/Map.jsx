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
const {createSelector} = require('reselect');

const {mapSelector} = require('../../MapStore2Components/selectors/map');
const {layerSelectorWithMarkers} = require('../../MapStore2Components/selectors/layers');
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
                        type={feature.type}
                        geometry={feature.geometry}
                        featureId={feature.id}
                        crs={layer.featuresCrs || 'EPSG:4326'}
                        layerCrs={layerCrs}
                        style={feature.style || null}/>
                );
            });
        }
        return null;
    }
    renderLayers = () => {
        const projection = this.props.map.projection || 'EPSG:3857';
        return this.props.layers.map((layer, index) => {
            return (
                <MapComponents.Layer type={layer.type} srs={projection} position={index} key={layer.id || layer.name} options={layer}>
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
    MapPlugin: connect(createSelector([mapSelector, layerSelectorWithMarkers], (map, layers) => ({
        map,
        layers,
        tools
    })))(MapPlugin)
}};

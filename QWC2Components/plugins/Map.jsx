/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');

const {mapSelector} = require('../../MapStore2/web/client/selectors/map');
const {layerSelectorWithMarkers} = require('../../MapStore2/web/client/selectors/layers');
const MapComponents = require('./map/MapComponents');

require('./style/Map.css');


const MapPlugin = React.createClass({
    propTypes: {
        map: React.PropTypes.object,
        layers: React.PropTypes.array,
        projection: React.PropTypes.string,
        maxExtent: React.PropTypes.array,
        tools: React.PropTypes.object,
        toolsOptions: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            projection: "EPSG:3857",
            tools: {},
            toolsOptions: {}
        };
    },
    renderLayerContent(layer) {
        const projection = this.props.map.projection || 'EPSG:3857';
        if (layer.features && layer.type === "vector") {
            return layer.features.map( (feature) => {
                return (
                    <MapComponents.Feature
                        key={feature.id}
                        type={feature.type}
                        geometry={feature.geometry}
                        msId={feature.id}
                        featuresCrs={layer.featuresCrs || 'EPSG:4326'}
                        layerCrs={layer.crs || projection}
                        // FEATURE STYLE OVERWRITE LAYER STYLE
                        style={ feature.style || layer.style || null }/>
                );
            });
        }
        return null;
    },
    renderLayers() {
        const projection = this.props.map.projection || 'EPSG:3857';
        return this.props.layers.map((layer, index) => {
            return (
                <MapComponents.Layer type={layer.type} srs={projection} position={index} key={layer.id || layer.name} options={layer}>
                    {this.renderLayerContent(layer)}
                </MapComponents.Layer>
            );
        });
    },
    renderSupportTools() {
        return Object.keys(this.props.tools).map((tool) => {
            const Tool = this.props.tools[tool];
            const options = this.props.toolsOptions[tool] || {};
            return <Tool key={tool} {...options}/>;
        });
    },
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
});

module.exports = (tools) => { return {
    MapPlugin: connect(createSelector([mapSelector, layerSelectorWithMarkers], (map, layers) => ({
        map,
        layers,
        tools
    })))(MapPlugin)
}};

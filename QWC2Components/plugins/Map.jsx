/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const Proj4js = require('proj4');
const {DEFAULT_SCREEN_DPI} = require('../../MapStore2/web/client/utils/MapUtils');
const {changeMapView} = require('../actions/map');
const {MapPlugin} = require('../../MapStore2/web/client/plugins/Map');
require('./style/Map.css');

const QWCMapPlugin = React.createClass({
    propTypes: {
        projection: React.PropTypes.string,
        units: React.PropTypes.string,
        maxExtent: React.PropTypes.array,
        scales: React.PropTypes.array,
        zoomControl: React.PropTypes.bool,
        mapType: React.PropTypes.string
    },
    getDefaultProps() {
        return {
            zoomControl: true,
            mapType: 'openlayers'
        };
    },
    getInitialState: function() {
        return {resolutions: undefined};
    },
    componentWillReceiveProps(newProps) {
        if (this.state.resolutions === undefined && newProps.scales !== undefined) {
            // Set map resolutions based on scales config
            // calculate resolutions from scales for map projection
            const proj = new Proj4js.Proj(newProps.projection || "EPSG:3857");
            const metersPerUnit = proj.units === 'degrees' ? 111194.87428468118 : 1;
            const resolutions = newProps.scales.map((scale) => {
                return scale / (metersPerUnit * (DEFAULT_SCREEN_DPI / 0.0254));
            });
            this.setState({resolutions: resolutions});
        }
    },
    render() {
        let options = {
            projection: this.props.projection,
            units: this.props.units,
            maxExtent: this.props.maxExtent,
            mapOptions: {
                controls: {
                    attributionOptions: {
                        collapsible: false
                    }
                }
            }
        };
        if (this.state.resolutions !== undefined) {
            options.mapOptions.view = {
                resolutions: this.state.resolutions
            };
        }
        return (
            <MapPlugin
                actions={{onMapViewChanges: changeMapView}}
                zoomControl={this.props.zoomControl}
                mapType={this.props.mapType}
                options={options} />
        );
    }
});

module.exports = {
    MapPlugin: QWCMapPlugin
};

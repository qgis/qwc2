/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
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
        mapType: React.PropTypes.string,
        actions: React.PropTypes.object,
        tools: React.PropTypes.array,
        toolsOptions: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            zoomControl: false,
            actions: {onMapViewChanges: changeMapView},
            tools: ['measurement', 'draw', 'locate', 'overview', 'scalebar', 'selection'],
            toolsOptions: {
                measurement: {updateOnMouseMove: true},
                overview: { layers: [] }
            },
            mapType: "openlayers",
            projection: "EPSG:3857"
        };
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
        return (
            <MapPlugin
                projection={this.props.projection}
                actions={this.props.actions}
                zoomControl={this.props.zoomControl}
                mapType={this.props.mapType}
                options={options}
                tools={this.props.tools}
                toolsOptions={this.props.toolsOptions} />
        );
    }
});

module.exports = {
    MapPlugin: QWCMapPlugin
};

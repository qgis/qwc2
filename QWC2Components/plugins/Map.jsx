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
        mapType: React.PropTypes.string
    },
    getDefaultProps() {
        return {
            zoomControl: true,
            mapType: 'openlayers'
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
                actions={{onMapViewChanges: changeMapView}}
                zoomControl={this.props.zoomControl}
                mapType={this.props.mapType}
                options={options}
                tools={['measurement', 'draw', 'locate', 'overview', 'scalebar']} />
        );
    }
});

module.exports = {
    MapPlugin: QWCMapPlugin
};

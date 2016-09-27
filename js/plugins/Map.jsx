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

const QWCMapPlugin = React.createClass({
    propTypes: {
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
        return (
            <MapPlugin
                actions={{onMapViewChanges: changeMapView}}
                zoomControl={this.props.zoomControl}
                mapType={this.props.mapType} />
        );
    }
});

module.exports = {
    MapPlugin: QWCMapPlugin
};

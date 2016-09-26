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
      zoomControl: React.PropTypes.bool
    },
    getDefaultProps() {
        return {
            zoomControl: true
        };
    },
    render() {
        return (
            <MapPlugin changeMapViewAction={changeMapView} zoomControl={this.props.zoomControl} />
        );
    }
});

module.exports = {
    MapPlugin: QWCMapPlugin
};

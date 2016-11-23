/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const {connect} = require('react-redux');
 const {loadMapConfig} = require('../actions/config');

const MapViewer = connect(() => ({}), {
    loadMapConfig: loadMapConfig
})(require('../../MapStore2/web/client/containers/MapViewer'));

module.exports = MapViewer;

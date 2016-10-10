/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {loadMapConfig} = require('../actions/config');
require('./css/mapStyle.css');
var Proj4js = require('proj4');


Proj4js.defs("EPSG:21781","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");

const MapViewer = connect(() => ({}), {
    loadMapConfig: loadMapConfig.bind(null, "config.json", false)
})(require('../../MapStore2/web/client/containers/MapViewer'));

const Main = (props) => <MapViewer plugins={props.plugins} params={{mapType: "leaflet"}}/>;

module.exports = Main;

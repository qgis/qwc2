/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const {mapSelector} = require('../../MapStore2/web/client/selectors/map');
const {changeZoomLevel} = require('../../MapStore2/web/client/actions/map');
const ZoomButton = require('../../MapStore2/web/client/components/buttons/ZoomButton');
require('./style/Buttons.css');

const zoomInSelector = createSelector([mapSelector], (map) => (
    {currentZoom: map && map.zoom, id: "ZoomInBtn", step: 1, glyphicon: "plus"}
));

const zoomOutSelector = createSelector([mapSelector], (map) => (
    {currentZoom: map && map.zoom, id: "ZoomOutBtn", step: -1, glyphicon: "minus"}
));

module.exports = {
    ZoomInPlugin: connect(zoomInSelector, {
        onZoom: changeZoomLevel
    })(ZoomButton),
    ZoomOutPlugin: connect(zoomOutSelector, {
        onZoom: changeZoomLevel
    })(ZoomButton),
    reducers: { zoomIn: require("../../MapStore2/web/client/reducers/map")}
};

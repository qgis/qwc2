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

const ZoomInButton = React.createClass({
    propTypes: {
        currentZoom : React.PropTypes.number,
        position: React.PropTypes.number,
        onZoom: React.PropTypes.func,
        maxZoom: React.PropTypes.number
    },
    getDefaultProps() {
        return { position: 4 }
    },
    render() {
        return (
            <ZoomButton onZoom={this.props.onZoom} step={1} currentZoom={this.props.currentZoom} maxZoom={this.props.maxZoom}
                id="ZoomInBtn" glyphicon="plus" style={{bottom: (5 + 4 * this.props.position) + 'em'}} />
        );
    }
});

const ZoomOutButton = React.createClass({
    propTypes: {
        currentZoom : React.PropTypes.number,
        position: React.PropTypes.number,
        onZoom: React.PropTypes.func,
        maxZoom: React.PropTypes.number
    },
    getDefaultProps() {
        return { position: 3 }
    },
    render() {
        return (
            <ZoomButton onZoom={this.props.onZoom} step={-1} currentZoom={this.props.currentZoom} maxZoom={this.props.maxZoom}
                id="ZoomOutBtn" glyphicon="minus" style={{bottom: (5 + 4 * this.props.position) + 'em'}} />
        );
    }
});

const zoomInSelector = createSelector([mapSelector], (map) => (
    {
        currentZoom: map && map.zoom,
        maxZoom: map && map.mapOptions && map.mapOptions.view && map.mapOptions.view.resolutions ? map.mapOptions.view.resolutions.length - 1 : 0
    }
));

const zoomOutSelector = createSelector([mapSelector], (map) => (
    {
        currentZoom: map && map.zoom,
        maxZoom: map && map.mapOptions && map.mapOptions.view && map.mapOptions.view.resolutions ? map.mapOptions.view.resolutions.length - 1 : 0
    }
));

module.exports = {
    ZoomInPlugin: connect(zoomInSelector, {
        onZoom: changeZoomLevel
    })(ZoomInButton),
    ZoomOutPlugin: connect(zoomOutSelector, {
        onZoom: changeZoomLevel
    })(ZoomOutButton),
    reducers: { zoomIn: require("../../MapStore2/web/client/reducers/map")}
};

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const objectPath = require('object-path');
const {changeZoomLevel} = require('../../MapStore2Components/actions/map');
const ZoomButton = require('../../MapStore2Components/components/buttons/ZoomButton');
require('./style/Buttons.css');

class ZoomInButton extends React.Component {
    static propTypes = {
        currentZoom : PropTypes.number,
        position: PropTypes.number,
        onZoom: PropTypes.func,
        maxZoom: PropTypes.number
    }
    static defaultProps = {
        position: 4
    }
    render() {
        return (
            <ZoomButton onZoom={this.props.onZoom} step={1} currentZoom={this.props.currentZoom} maxZoom={this.props.maxZoom}
                id="ZoomInBtn" glyphicon="plus" style={{bottom: (5 + 4 * this.props.position) + 'em'}} />
        );
    }
};

class ZoomOutButton extends React.Component {
    static propTypes = {
        currentZoom : PropTypes.number,
        position: PropTypes.number,
        onZoom: PropTypes.func,
        maxZoom: PropTypes.number
    }
    static defaultProps = {
        position: 3
    }
    render() {
        return (
            <ZoomButton onZoom={this.props.onZoom} step={-1} currentZoom={this.props.currentZoom} maxZoom={this.props.maxZoom}
                id="ZoomOutBtn" glyphicon="minus" style={{bottom: (5 + 4 * this.props.position) + 'em'}} />
        );
    }
};

const zoomInSelector = (state) => (
    {
        currentZoom: objectPath.get(state, "map.zoom", 0),
        maxZoom: objectPath.get(state, "map.mapOptions.view.resolutions", [0]).length - 1
    }
);

const zoomOutSelector = (state) => (
    {
        currentZoom: objectPath.get(state, "map.zoom", 0),
        maxZoom: objectPath.get(state, "map.mapOptions.view.resolutions", [0]).length - 1
    }
);

module.exports = {
    ZoomInPlugin: connect(zoomInSelector, {
        onZoom: changeZoomLevel
    })(ZoomInButton),
    ZoomOutPlugin: connect(zoomOutSelector, {
        onZoom: changeZoomLevel
    })(ZoomOutButton),
    reducers: {
        map: require("../../MapStore2Components/reducers/map")
    }
};

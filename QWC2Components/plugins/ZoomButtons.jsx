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
const {changeZoomLevel} = require('../actions/map');
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


module.exports = {
    ZoomInPlugin: connect((state) => ({
        currentZoom: state.map.zoom,
        maxZoom: state.map.resolutions.length - 1
    }),{
        onZoom: changeZoomLevel
    })(ZoomInButton),
    ZoomOutPlugin: connect((state) => ({
        currentZoom: state.map.zoom,
        maxZoom: state.map.resolutions.length - 1
    }),{
        onZoom: changeZoomLevel
    })(ZoomOutButton),
    reducers: {
        map: require("../reducers/map")
    }
};

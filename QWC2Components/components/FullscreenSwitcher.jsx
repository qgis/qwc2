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
const {toggleFullscreen} = require('../actions/display');
require('./style/FullscreenSwitcher.css');

class FullscreenSwitcher extends React.Component {
    static propTypes = {
        mobile: PropTypes.bool,
        fullscreen: PropTypes.bool,
        fullscreenToggled: PropTypes.func
    }
    static defaultProps = {
        fullscreen: false
    }
    toggleFullscreen = () => {
        this.props.fullscreenToggled(!this.props.fullscreen);
    }
    componentDidMount() {
        if(document.onfullscreenchange !== undefined) {
            document.onfullscreenchange = this.checkFullscreenState;
        } else if(document.onwebkitfullscreenchange !== undefined) {
            document.onwebkitfullscreenchange = this.checkFullscreenState;
        } else if(document.onmozfullscreenchange !== undefined) {
            document.onmozfullscreenchange = this.checkFullscreenState;
        } else if(document.onmsfullscreenchange !== undefined) {
            document.onmsfullscreenchange = this.checkFullscreenState;
        }
        if(document.onfullscreenerror !== undefined) {
            document.onfullscreenerror = this.checkFullscreenState;
        } else if(document.onwebkitfullscreenerror !== undefined) {
            document.onwebkitfullscreenerror = this.checkFullscreenState;
        } else if(document.onmozfullscreenerror !== undefined) {
            document.onmozfullscreenerror = this.checkFullscreenState;
        } else if(document.onmsfullscreenerror !== undefined) {
            document.onmsfullscreenerror = this.checkFullscreenState;
        }
    }
    checkFullscreenState = () => {
        var isFullScreen = (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        ) != undefined;
        if(isFullScreen != this.props.fullscreen) {
            this.props.fullscreenToggled(!this.props.fullscreen);
        }
    }
    render() {
        // Render nothing on mobile, but keep the component for the onfullscreenchange logic
        if(this.props.mobile) {
            return null;
        }
        return (
            <span id="FullScreenSwitcher" onClick={this.toggleFullscreen}>
                <span className={this.props.fullscreen ? "minimize" : "maximize"}></span>
            </span>
        );
    }
};

const selector = (state) => ({
    mobile: state.browser ? state.browser.mobile : false,
    fullscreen: state.display && state.display.fullscreen
});

module.exports = connect(selector, {
    fullscreenToggled: toggleFullscreen
})(FullscreenSwitcher);

/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {toggleFullscreen} from '../actions/display';
import LocaleUtils from '../utils/LocaleUtils';

import './style/FullscreenSwitcher.css';

class FullscreenSwitcher extends React.Component {
    static propTypes = {
        fullscreen: PropTypes.bool,
        fullscreenToggled: PropTypes.func,
        mobile: PropTypes.bool
    };
    toggleFullscreen = () => {
        this.props.fullscreenToggled(!this.props.fullscreen);
    };
    componentDidMount() {
        if (document.onfullscreenchange !== undefined) {
            document.onfullscreenchange = this.checkFullscreenState;
        } else if (document.onwebkitfullscreenchange !== undefined) {
            document.onwebkitfullscreenchange = this.checkFullscreenState;
        } else if (document.onmozfullscreenchange !== undefined) {
            document.onmozfullscreenchange = this.checkFullscreenState;
        } else if (document.onmsfullscreenchange !== undefined) {
            document.onmsfullscreenchange = this.checkFullscreenState;
        }
        if (document.onfullscreenerror !== undefined) {
            document.onfullscreenerror = this.checkFullscreenState;
        } else if (document.onwebkitfullscreenerror !== undefined) {
            document.onwebkitfullscreenerror = this.checkFullscreenState;
        } else if (document.onmozfullscreenerror !== undefined) {
            document.onmozfullscreenerror = this.checkFullscreenState;
        } else if (document.onmsfullscreenerror !== undefined) {
            document.onmsfullscreenerror = this.checkFullscreenState;
        }
    }
    checkFullscreenState = () => {
        const isFullScreen = (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        ) !== undefined;
        if (isFullScreen !== this.props.fullscreen) {
            this.props.fullscreenToggled(!this.props.fullscreen);
        }
    };
    render() {
        // Render nothing on mobile, but keep the component for the onfullscreenchange logic
        if (this.props.mobile) {
            return null;
        }
        const tooltip = this.props.fullscreen ? LocaleUtils.tr("tooltip.fullscreendisable") : LocaleUtils.tr("tooltip.fullscreenenable");
        return (
            <span id="FullScreenSwitcher" onClick={this.toggleFullscreen} title={tooltip}>
                <span className={this.props.fullscreen ? "minimize" : "maximize"} />
            </span>
        );
    }
}

const selector = (state) => ({
    mobile: state.browser.mobile,
    fullscreen: state.display.fullscreen
});

export default connect(selector, {
    fullscreenToggled: toggleFullscreen
})(FullscreenSwitcher);

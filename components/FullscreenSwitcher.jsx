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
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/FullscreenSwitcher.css';

class FullscreenSwitcher extends React.Component {
    static propTypes = {
        fullscreen: PropTypes.bool,
        fullscreenToggled: PropTypes.func
    };
    toggleFullscreen = () => {
        this.props.fullscreenToggled(!this.props.fullscreen);
    };
    componentDidMount() {
        document.addEventListener('fullscreenchange', this.checkFullscreenState);
        document.addEventListener('webkitfullscreenchange', this.checkFullscreenState);
        document.addEventListener('fullscreenerror', this.checkFullscreenState);
        document.addEventListener('webkitfullscreenerror', this.checkFullscreenState);
    }
    componentWillUnmount() {
        document.removeEventListener('fullscreenchange', this.checkFullscreenState);
        document.removeEventListener('webkitfullscreenchange', this.checkFullscreenState);
        document.removeEventListener('fullscreenerror', this.checkFullscreenState);
        document.removeEventListener('webkitfullscreenerror', this.checkFullscreenState);
    }
    checkFullscreenState = () => {
        const isFullScreen = (document.fullscreenElement ?? document.webkitFullscreenElement ?? null) !== null;
        if (isFullScreen !== this.props.fullscreen) {
            this.props.fullscreenToggled(isFullScreen);
        }
    };
    render() {
        // Render nothing on mobile, but keep the component for the onfullscreenchange logic
        if (ConfigUtils.isMobile()) {
            return null;
        }
        const tooltip = this.props.fullscreen ? LocaleUtils.tr("tooltip.fullscreendisable") : LocaleUtils.tr("tooltip.fullscreenenable");
        return (
            <div className="FullScreenSwitcher" onClick={this.toggleFullscreen} title={tooltip}>
                <span className={this.props.fullscreen ? "minimize" : "maximize"} />
            </div>
        );
    }
}


export default connect((state) => ({
    fullscreen: state.display.fullscreen
}), {
    fullscreenToggled: toggleFullscreen
})(FullscreenSwitcher);

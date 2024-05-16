/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import LocaleUtils from '../utils/LocaleUtils';
import {zoomToExtent} from '../actions/map';
import Icon from '../components/Icon';
import './style/Buttons.css';


/**
 * Map button for reverting to the home extent of the theme.
 */
class HomeButton extends React.Component {
    static propTypes = {
        currentTheme: PropTypes.object,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        splitScreen: PropTypes.object,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        position: 5
    };
    render() {
        const splitWindows = Object.values(this.props.splitScreen);
        const right = splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0);
        const bottom = splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0);
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(var(--bottombar-height) + ' + bottom + 'px + ' + (3 + 4 * this.props.position) + 'em)'
        };
        const tooltip = LocaleUtils.tr("tooltip.home");
        return (
            <button className="map-button" onClick={this.resetExtent} style={style} title={tooltip}>
                <Icon icon="home" title={tooltip}/>
            </button>
        );
    }
    resetExtent = () => {
        if (this.props.currentTheme) {
            const bbox = this.props.currentTheme.initialBbox;
            this.props.zoomToExtent(bbox.bounds, bbox.crs);
        }
    };
}

export default connect((state) => ({
    currentTheme: state.theme.current,
    splitScreen: state.windows.splitScreen
}), {
    zoomToExtent: zoomToExtent
})(HomeButton);

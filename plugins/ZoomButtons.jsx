/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import LocaleUtils from '../utils/LocaleUtils';
import {changeZoomLevel} from '../actions/map';
import Icon from '../components/Icon';
import './style/Buttons.css';

/**
 * Map button for zooming the map.
 *
 * Two specific plugins exist: ZoomInPlugin and ZoomOutPlugin, which are instances of ZoomButton for the respective zoom directions.
 */
class ZoomButton extends React.Component {
    static propTypes = {
        changeZoomLevel: PropTypes.func,
        currentZoom: PropTypes.number,
        direction: PropTypes.number,
        maxZoom: PropTypes.number,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        splitScreen: PropTypes.object
    };
    render() {
        const defaultPosition = (this.props.direction > 0 ? 4 : 3);
        const position = this.props.position >= 0 ? this.props.position : defaultPosition;
        const splitWindows = Object.values(this.props.splitScreen);
        const right = splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0);
        const bottom = splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0);
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(' + bottom + 'px  + ' + (5 + 4 * position) + 'em)'
        };
        let disabled = false;
        if (this.props.direction > 0) {
            disabled = this.props.currentZoom >= this.props.maxZoom;
        } else if (this.props.direction < 0) {
            disabled = this.props.currentZoom <= 0;
        }
        const tooltip = this.props.direction > 0 ? LocaleUtils.tr("tooltip.zoomin") : LocaleUtils.tr("tooltip.zoomout");
        const classes = classnames({
            "map-button": true,
            ["map-button-" + this.props.position]: true
        });
        return (
            <button className={classes}
                disabled={disabled}
                onClick={() => this.props.changeZoomLevel(this.props.currentZoom + this.props.direction)}
                style={style}
                title={tooltip}
            >
                <Icon icon={this.props.direction > 0 ? "plus" : "minus"} title={tooltip}/>
            </button>
        );
    }
}

export const ZoomInPlugin = connect((state) => ({
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: +1,
    splitScreen: state.windows.splitScreen
}), {
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

export const ZoomOutPlugin = connect((state) => ({
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: -1,
    splitScreen: state.windows.splitScreen
}), {
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

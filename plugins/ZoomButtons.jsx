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
import LocaleUtils from '../utils/LocaleUtils';
import {changeZoomLevel} from '../actions/map';
import Icon from '../components/Icon';
import ThemeUtils from '../utils/ThemeUtils';
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
        mapMargins: PropTypes.object,
        maxZoom: PropTypes.number,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
<<<<<<< HEAD
=======
        rightMargin: PropTypes.number,
        splitScreen: PropTypes.object,
>>>>>>> 390fa289 (Use setRightMargin action)
        theme: PropTypes.object,
        /** Omit the button in themes matching one of these flags. */
        themeFlagBlacklist: PropTypes.arrayOf(PropTypes.string),
        /** Only show the button in themes matching one of these flags. */
        themeFlagWhitelist: PropTypes.arrayOf(PropTypes.string)
    };
    render() {
        if (!ThemeUtils.themFlagsAllowed(this.props.theme, this.props.themeFlagWhitelist, this.props.themeFlagBlacklist)) {
            return null;
        }
        const defaultPosition = (this.props.direction > 0 ? 4 : 3);
        const position = this.props.position >= 0 ? this.props.position : defaultPosition;
        const right = this.props.mapMargins.right;
        const bottom = this.props.mapMargins.bottom;
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
        return (
            <button className="map-button"
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
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}), {
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

export const ZoomOutPlugin = connect((state) => ({
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: -1,
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}), {
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

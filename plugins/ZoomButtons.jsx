/**
 * Copyright 2016, Sourcepole AG.
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
import './style/Buttons.css';

class ZoomButton extends React.Component {
    static propTypes = {
        changeZoomLevel: PropTypes.func,
        currentZoom: PropTypes.number,
        direction: PropTypes.number,
        maxZoom: PropTypes.number,
        position: PropTypes.number
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        const position = this.props.position >= 0 ? this.props.position : (this.props.direction > 0 ? 4 : 3);
        let disabled = false;
        if (this.props.direction > 0) {
            disabled = this.props.currentZoom >= this.props.maxZoom;
        } else if (this.props.direction < 0) {
            disabled = this.props.currentZoom <= 0;
        }
        const tooltip = LocaleUtils.getMessageById(this.context.messages, this.props.direction > 0 ? "tooltip.zoomin" : "tooltip.zoomout");
        return (
            <button className="map-button"
                disabled={disabled}
                onClick={() => this.props.changeZoomLevel(this.props.currentZoom + this.props.direction)}
                style={{bottom: (5 + 4 * position) + 'em'}}
                title={tooltip}
            >
                <Icon icon={this.props.direction > 0 ? "plus" : "minus"}/>
            </button>
        );
    }
}

export const ZoomInPlugin = connect((state) => ({
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: +1
}),
{
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

export const ZoomOutPlugin = connect((state) => ({
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: -1
}),
{
    changeZoomLevel: changeZoomLevel
})(ZoomButton);

/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import {changeZoomLevel, zoomToExtent, zoomToPoint} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import MapSelection from '../components/MapSelection';
import LocaleUtils from '../utils/LocaleUtils';
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
        click: PropTypes.object,
        currentTask: PropTypes.string,
        currentZoom: PropTypes.number,
        direction: PropTypes.number,
        /** Enable zoom in or out by box selection. */
        enableZoomByBoxSelection: PropTypes.bool,
        mapCrs: PropTypes.string,
        mapMargins: PropTypes.object,
        maxZoom: PropTypes.number,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        /** Omit the button in themes matching one of these flags. */
        themeFlagBlacklist: PropTypes.arrayOf(PropTypes.string),
        /** Only show the button in themes matching one of these flags. */
        themeFlagWhitelist: PropTypes.arrayOf(PropTypes.string),
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.task = props.direction > 0 ? "ZoomIn" : "ZoomOut";
    }
    state = {
        disabled: false
    };
    componentDidUpdate(prevProps) {
        if (prevProps.currentZoom !== this.props.currentZoom || prevProps.maxZoom !== this.props.maxZoom) {
            if (this.props.direction > 0) {
                this.setState({disabled: this.props.currentZoom >= this.props.maxZoom});
            } else if (this.props.direction < 0) {
                this.setState({disabled: this.props.currentZoom <= 0});
            }
        }
        if (this.props.currentTask === this.task && this.props.click !== prevProps.click) {
            const point = this.props.click?.coordinate;
            if (point) {
                const zoom = Math.max(0, this.props.currentZoom + this.props.direction);
                this.props.zoomToPoint(point, zoom, this.mapCrs);
            }
        }
    }
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
        const tooltip = this.props.direction > 0 ? LocaleUtils.tr("tooltip.zoomin") : LocaleUtils.tr("tooltip.zoomout");
        const classes = classnames({
            "map-button": true,
            "map-button-active": this.props.enableZoomByBoxSelection && this.props.currentTask === this.task,
            "map-button-disabled": this.state.disabled
        });
        return [(
            <button className={classes}
                key={this.task + "Button"}
                onClick={this.buttonClicked}
                style={style}
                title={tooltip}
            >
                <Icon icon={this.props.direction > 0 ? "plus" : "minus"} title={tooltip}/>
            </button>
        ), (
            this.props.currentTask === this.task ? (
                <MapSelection
                    active cursor={this.props.direction > 0 ? "zoom-in" : "zoom-out"}
                    geomType="DragBox"
                    geometryChanged={(geom) => this.updateZoom(geom)}
                    key="MapSelection"
                />
            ) : null
        )];
    }
    buttonClicked = () => {
        if (this.props.enableZoomByBoxSelection) {
            this.props.setCurrentTask(this.props.currentTask === this.task ? null : this.task);
        } else if (!this.state.disabled) {
            this.props.changeZoomLevel(this.props.currentZoom + this.props.direction);
        }
    };
    updateZoom = (geom) => {
        const zoomBox = geom.coordinates[0];
        if (this.props.direction > 0) {
            this.props.zoomToExtent(zoomBox, this.props.mapCrs);
        } else {
            const center = [0.5 * (zoomBox[0] + zoomBox[2]), 0.5 * (zoomBox[1] + zoomBox[3])];
            const zoom = Math.max(0, this.props.currentZoom + this.props.direction);
            this.props.zoomToPoint(center, zoom, this.props.mapCrs);
        }
    };
}

export const ZoomInPlugin = connect((state) => ({
    click: state.map.click,
    currentTask: state.task.id,
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: +1,
    mapCrs: state.map.projection,
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}), {
    changeZoomLevel: changeZoomLevel,
    setCurrentTask: setCurrentTask,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(ZoomButton);

export const ZoomOutPlugin = connect((state) => ({
    click: state.map.click || {},
    currentTask: state.task.id,
    currentZoom: state.map.zoom,
    maxZoom: state.map.resolutions.length - 1,
    direction: -1,
    mapCrs: state.map.projection,
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}), {
    changeZoomLevel: changeZoomLevel,
    setCurrentTask: setCurrentTask,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(ZoomButton);

/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';

import MapUtils from '../utils/MapUtils';

import './style/PrintFrame.css';

export default class PrintFrame extends React.Component {
    static propTypes = {
        bboxSelected: PropTypes.func,
        dpi: PropTypes.number,
        fixedFrame: PropTypes.shape({
            width: PropTypes.number, // in meters
            height: PropTypes.number // in meters
        }),
        map: PropTypes.object.isRequired
    };
    static defaultProps = {
        bboxSelected: () => {},
        dpi: 96
    };
    state = {
        x: 0, y: 0, width: 0, height: 0, moving: false
    };
    componentDidMount() {
        this.recomputeBox(this.props, {});
    }
    componentDidUpdate(prevProps) {
        if (
            this.props.map.center !== prevProps.map.center ||
            this.props.map.bbox !== prevProps.map.bbox ||
            this.props.dpi !== prevProps.dpi ||
            !isEqual(this.props.fixedFrame, prevProps.fixedFrame)
        ) {
            this.recomputeBox();
        }
        if (!this.props.fixedFrame && prevProps.fixedFrame) {
            this.setState({x: 0, y: 0, width: 0, height: 0, moving: false});
        }
    }
    recomputeBox = () => {
        if (this.props.fixedFrame) {
            const getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
            let newState = {x: 0, y: 0, width: 0, height: 0, moving: false};
            const cosa = Math.cos(-this.props.map.bbox.rotation);
            const sina = Math.sin(-this.props.map.bbox.rotation);
            const center = this.props.map.center;
            const {width, height} = MapUtils.transformExtent(this.props.map.projection, center, this.props.fixedFrame.width, this.props.fixedFrame.height);
            const mapp1 = [
                center[0] - 0.5 * width * cosa - 0.5 * height * sina,
                center[1] + 0.5 * width * sina - 0.5 * height * cosa
            ];
            const mapp2 = [
                center[0] + 0.5 * width * cosa + 0.5 * height * sina,
                center[1] - 0.5 * width * sina + 0.5 * height * cosa
            ];
            const pixp1 = getPixelFromCoordinate(mapp1);
            const pixp2 = getPixelFromCoordinate(mapp2);
            newState = {
                x: Math.min(pixp1[0], pixp2[0]),
                y: Math.min(pixp1[1], pixp2[1]),
                width: Math.abs(pixp2[0] - pixp1[0]),
                height: Math.abs(pixp2[1] - pixp1[1])
            };
            this.setState(newState);
        }
        this.endSelection();
    };
    startSelection = (ev) => {
        if (ev.button === 1) {
            document.addEventListener('mouseup', () => { ev.target.style.pointerEvents = ''; }, {once: true});
            // Move behind
            ev.target.style.pointerEvents = 'none';
            MapUtils.getHook(MapUtils.GET_MAP).getViewport().dispatchEvent(new MouseEvent('pointerdown', ev));
            return;
        }
        const x = Math.round(ev.clientX);
        const y = Math.round(ev.clientY);
        this.setState({
            x: x,
            y: y,
            width: 0,
            height: 0,
            moving: true
        });
    };
    updateSelection = (ev) => {
        if (this.state.moving) {
            this.setState((state) => {
                const x = Math.round(ev.clientX);
                const y = Math.round(ev.clientY);
                const width = Math.round(Math.max(0, x - state.x));
                const height = Math.round(Math.max(0, y - state.y));
                return {
                    width: width,
                    height: height
                };
            });
        }
    };
    endSelection = () => {
        if (this.state.moving) {
            this.setState({moving: false});
            const getCoordinateFromPixel = MapUtils.getHook(MapUtils.GET_COORDINATES_FROM_PIXEL_HOOK);
            const p1 = getCoordinateFromPixel([this.state.x, this.state.y]);
            const p2 = getCoordinateFromPixel([this.state.x + this.state.width, this.state.y + this.state.height]);
            const bbox = [
                Math.min(p1[0], p2[0]),
                Math.min(p1[1], p2[1]),
                Math.max(p1[0], p2[0]),
                Math.max(p1[1], p2[1])
            ];
            if (bbox[0] !== bbox[2] && bbox[1] !== bbox[3]) {
                const dpiScale = this.props.dpi / 96;
                this.props.bboxSelected(bbox, this.props.map.projection, [this.state.width * dpiScale, this.state.height * dpiScale]);
            } else {
                this.props.bboxSelected(null, this.props.map.projection, [0, 0]);
            }
        }
    };
    render() {
        const boxStyle = {
            left: this.state.x + 'px',
            top: this.state.y + 'px',
            width: this.state.width + 'px',
            height: this.state.height + 'px',
            lineHeight: this.state.height + 'px'
        };
        if (this.props.fixedFrame) {
            return (
                <div id="PrintFrame" style={boxStyle} />
            );
        } else {
            return (
                <div id="PrintFrameEventLayer"
                    onMouseDown={this.startSelection}
                    onMouseMove={this.updateSelection}
                    onMouseUp={this.endSelection}
                    onTouchEnd={(ev) => this.endSelection(ev.changedTouches[0])}
                    onTouchMove={(ev) => {this.updateSelection(ev.changedTouches[0]); ev.preventDefault();}}
                    onTouchStart={(ev) => this.startSelection(ev.changedTouches[0])}
                >
                    <div id="PrintFrame" style={boxStyle}>
                        <span className="size-box">{this.state.width + " x " + this.state.height}</span>
                    </div>
                </div>
            );
        }
    }
}

/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import MiscUtils from '../utils/MiscUtils';

import './style/ExportSelection.css';

export default class ExportSelection extends React.Component {
    static propTypes = {
        frame: PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            width: PropTypes.number,
            height: PropTypes.number,
        }),
        frameRatio: PropTypes.number,
        mapElement: PropTypes.object,
        onFrameChanged: PropTypes.func
    };
    state = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        frameRatio: null
    };
    componentDidUpdate(prevProps) {
        if (this.props.frame !== prevProps.frame) {
            this.setState({...this.props.frame});
        }
        if (this.props.frameRatio !== prevProps.frameRatio) {
            this.setState(state => {
                const newheight = this.props.frameRatio ? Math.round(state.width * this.props.frameRatio) : state.height;
                return {
                    frameRatio: this.props.frameRatio,
                    y: state.y + 0.5 * (state.height - newheight),
                    height: newheight
                };
            }, () => {
                this.props.onFrameChanged(this.state);
            });
        }
    }
    render() {
        const boxStyle = {
            left: this.state.x + 'px',
            top: this.state.y + 'px',
            width: this.state.width + 'px',
            height: this.state.height + 'px'
        };
        return (
            <div className="export-selection-container">
                <div className="export-selection" onContextMenu={MiscUtils.killEvent} onPointerDown={this.startMoveSelection} style={boxStyle}>
                    <span className="export-selection-label">
                        {this.state.width + " x " + this.state.height}
                    </span>
                    <div className="export-selection-resize-top" onPointerDown={ev => this.startResizeSelection(ev, 0, -1)} />
                    <div className="export-selection-resize-bottom" onPointerDown={ev => this.startResizeSelection(ev, 0, 1)} />
                    <div className="export-selection-resize-left" onPointerDown={ev => this.startResizeSelection(ev, -1, 0)} />
                    <div className="export-selection-resize-right" onPointerDown={ev => this.startResizeSelection(ev, 1, 0)} />
                    <div className="export-selection-resize-topleft" onPointerDown={ev => this.startResizeSelection(ev, -1, -1)} />
                    <div className="export-selection-resize-topright" onPointerDown={ev => this.startResizeSelection(ev, 1, -1)} />
                    <div className="export-selection-resize-bottomleft" onPointerDown={ev => this.startResizeSelection(ev, -1, 1)} />
                    <div className="export-selection-resize-bottomright" onPointerDown={ev => this.startResizeSelection(ev, 1, 1)} />
                </div>
            </div>
        );
    }
    startMoveSelection = (ev) => {
        if (ev.ctrlKey) {
            return;
        }
        const startStateX = this.state.x;
        const startStateY = this.state.y;
        const onMouseMove = (event) => {
            this.setState({
                x: startStateX + event.clientX - ev.clientX,
                y: startStateY + event.clientY - ev.clientY
            });
        };
        ev.view.addEventListener('pointermove', onMouseMove);
        ev.view.addEventListener('pointerup', () => {
            ev.view.removeEventListener('pointermove', onMouseMove);
            this.props.onFrameChanged(this.state);
        }, {once: true});
        MiscUtils.killEvent(ev);
    };
    startResizeSelection = (ev, sx, sy) => {
        if (ev.ctrlKey) {
            return;
        }
        const {x, y, width, height, frameRatio} = this.state;
        const onMouseMove = (event) => {
            const dx = event.clientX - ev.clientX;
            const dy = event.clientY - ev.clientY;
            let newwidth = width + dx * sx;
            let newheight = height + dy * sy;
            if (frameRatio) {
                if (sx !== 0) {
                    newheight = Math.round(newwidth * frameRatio);
                } else {
                    newwidth = Math.round(newheight / frameRatio);
                }
            }
            let newx = sx < 0 ? x + (width - newwidth) : x;
            let newy = sy < 0 ? y + (height - newheight) : y;
            if (sx === 0) {
                newx += 0.5 * (width - newwidth);
            }
            if (sy === 0) {
                newy += 0.5 * (height - newheight);
            }
            this.setState({x: newx, y: newy, width: newwidth, height: newheight});
        };
        ev.view.addEventListener('pointermove', onMouseMove);
        ev.view.addEventListener('pointerup', () => {
            ev.view.removeEventListener('pointermove', onMouseMove);
            this.props.onFrameChanged(this.state);
        }, {once: true});
        MiscUtils.killEvent(ev);
    };
}

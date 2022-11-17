/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import Icon from './Icon';
import ButtonBar from './widgets/ButtonBar';
import LocaleUtils from '../utils/LocaleUtils';
import './style/ContinuousTimeline.css';


export default class ContinuousTimeline extends React.Component {
    static propTypes = {
        currentTimestamp: PropTypes.number,
        dialogWidth: PropTypes.number, // Just to trigger a re-render when the width changes
        enabled: PropTypes.bool,
        endTime: PropTypes.object,
        startTime: PropTypes.object,
        stepSizeUnit: PropTypes.string,
        timestampChanged: PropTypes.func
    }
    state = {
        ticksContainer: null,
        currentTimestampDrag: null,
        panOffset: 0, // pixels
        timeScale: 1,
        zoomFactor: 1 // 1 = [startTime, endTime] fits dialog width in linear scale
    }
    render() {
        const cursorPos = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.pos : ((-this.state.panOffset) + "px + 50%");
        const timestamp = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.time : this.props.currentTimestamp;
        const cursorStyle = {
            left: "calc(" + cursorPos + " - 2px)"
        };
        const labelStyle = {
            transform: "translateX(-50%)"
        };
        const navButtons = [
            {key: "home", tooltip: LocaleUtils.trmsg("timemanager.home"), icon: "home"},
            {key: "zoomout", tooltip: LocaleUtils.trmsg("timemanager.zoomout"), icon: "zoomout"},
            {key: "zoomin", tooltip: LocaleUtils.trmsg("timemanager.zoomin"), icon: "zoomin"}
        ];
        return (
            <div className="ctimeline" onWheel={this.onSliderWheel}>
                <div className="ctimeline-toolbar">
                    <ButtonBar buttons={navButtons} onClick={this.navButtonClicked} />
                    <div className="ctimeline-toolbar-timescale">
                        <span>{LocaleUtils.tr("timemanager.timelinescale")}: &nbsp;</span>
                        <input max="10" min="0.01" onChange={(ev) => this.setState({timeScale: parseFloat(ev.target.value)})} step="0.01" type="number" value={this.state.timeScale} />
                    </div>
                    <div className="ctimeline-toolbar-spacer" />
                </div>
                <div className="ctimeline-clip">
                    <div className="ctimeline-pan-left" onMouseDown={() => this.pan(-20)}>
                        <Icon icon="chevron-left" />
                    </div>
                    <div className="ctimeline-ticks" ref={this.setTicksRef}>
                        {this.renderTicks()}
                    </div>
                    <div className="ctimeline-pan-right" onMouseDown={() => this.pan(20)}>
                        <Icon icon="chevron-right" />
                    </div>
                </div>
                <div className="ctimeline-slider-container">
                    <div className="ctimeline-slider" onMouseDown={this.pickCurrentTimestamp} />
                    {this.props.enabled ? (
                        <div className="ctimeline-cursor" style={cursorStyle}>
                            <div className="ctimeline-cursor-label" style={labelStyle}>
                                {dayjs(timestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
    setTicksRef = (el) => {
        if (this.state.ticksContainer !== el) {
            this.setState({ticksContainer: el});
        }
    }
    pixelsToTimeDiffMS = (px, width, dt) => {
        const b = this.state.timeScale;
        return Math.sign(px) * Math.pow(Math.abs(px) / (0.5 * width), b) * (0.5 * dt) * this.state.zoomFactor;
    }
    renderTicks = () => {
        if (!this.state.ticksContainer) {
            return null;
        }

        const width = this.state.ticksContainer.offsetWidth;
        const deltaT = this.props.endTime.diff(this.props.startTime);
        const now = dayjs(this.props.currentTimestamp);
        const xnow = 0.5 * width;

        // Render one tick every 100px
        const ticks = [{
            perc: 50,
            time: now
        }];
        // Compute ticks before current time
        let x = xnow;
        x -= 100;
        while (x >= this.state.panOffset) {
            if (x < width + this.state.panOffset) {
                ticks.push({
                    perc: x / width * 100,
                    time: now + this.pixelsToTimeDiffMS(x - xnow, width, deltaT)
                });
            }
            x -= 100;
        }
        // Compute ticks after current time
        x = xnow;
        x += 100;
        while (x <= width + this.state.panOffset) {
            if (x > this.state.panOffset) {
                ticks.push({
                    perc: x / width * 100,
                    time: now + this.pixelsToTimeDiffMS(x - xnow, width, deltaT)
                });
            }
            x += 100;
        }
        // Intermediate ticks (lines only)
        const b = this.state.timeScale;
        const tickPos = [20, 40, 60, 80].map(p => Math.pow(p / 100, 1 / b) * 100);
        let i = 0;
        for (x = xnow; x - tickPos[i] >= this.state.panOffset;) {
            if (x - tickPos[i] < width + this.state.panOffset) {
                ticks.push({perc: (x - tickPos[i]) / width * 100});
            }
            i += 1;
            if (i >= tickPos.length) {
                x -= 100;
                i = 0;
            }
        }
        i = 0;
        for (x = xnow; x + tickPos[i] <= width + this.state.panOffset;) {
            if (x + tickPos[i] > this.state.panOffset) {
                ticks.push({perc: (x + tickPos[i]) / width * 100});
            }
            i += 1;
            if (i >= tickPos.length) {
                x += 100;
                i = 0;
            }
        }
        // Render ticks
        return ticks.map(tick => {
            const style = {
                left: "calc(" + (-this.state.panOffset) + "px + " + tick.perc + "% - 1px"
            };
            return (
                <span className={tick.time ? "ctimeline-ltick" : "ctimeline-tick"} key={"tick" + tick.perc} style={style}>
                    {tick.time ? (<span>{dayjs(tick.time).format("YYYY-MM-DD[\n]HH:mm:ss")}</span>) : null}
                </span>
            );
        });
    }
    navButtonClicked = (key) => {
        if (key === "home") {
            this.setState({panOffset: 0, zoomFactor: 1});
        } else if (key === "zoomin") {
            this.setState({zoomFactor: this.state.zoomFactor * 0.5});
        } else if (key === "zoomout") {
            this.setState({zoomFactor: this.state.zoomFactor * 2});
        }
    }
    pan = (offset) => {
        this.setState({panOffset: this.state.panOffset + offset});
        let panInterval = null;
        const panTimeout = setTimeout(() => {
            this.setState({panOffset: this.state.panOffset + offset});
            panInterval = setInterval(() => {
                this.setState({panOffset: this.state.panOffset + offset});
            }, 50);
        }, 250);
        document.addEventListener("mouseup", () => {
            clearInterval(panInterval);
            clearTimeout(panTimeout);
        }, {once: true, capture: true});
    }
    pickCurrentTimestamp = (event) => {
        clearTimeout(this.timestampChangeTimeout);
        const target = event.currentTarget;

        const computeTimestamp = (ev) => {
            if (!this.props.enabled) {
                return;
            }
            const rect = target.getBoundingClientRect();
            const deltaT = this.props.endTime.diff(this.props.startTime);
            const pos = ev.clientX;
            const dx = pos - (rect.left + 0.5 * rect.width) + this.state.panOffset;
            const newTimestamp = dayjs(this.props.currentTimestamp).add(this.pixelsToTimeDiffMS(dx, rect.width, deltaT), 'ms');
            this.setState({currentTimestampDrag: {
                pos: ((pos - rect.left) / rect.width * 100) + "%",
                time: newTimestamp,
                offset: dx
            }});
        };
        document.addEventListener("mousemove", computeTimestamp);
        document.addEventListener("mouseup", () => {
            if (this.state.currentTimestampDrag) {
                this.props.timestampChanged(+this.state.currentTimestampDrag.time);
                this.setState({
                    currentTimestampDrag: null,
                    panOffset: this.state.panOffset - this.state.currentTimestampDrag.offset
                });
            }
            document.removeEventListener("mousemove", computeTimestamp);
        }, {once: true, capture: true});
        computeTimestamp(event);
    }
    onSliderWheel = (ev) => {
        if (ev.shiftKey) {
            if (ev.deltaY < 0) {
                this.setState({zoomFactor: this.state.zoomFactor * 0.5});
            } else if (ev.deltaY > 0) {
                this.setState({zoomFactor: this.state.zoomFactor * 2});
            }
        } else {
            if (ev.deltaX < 0) {
                this.setState({panOffset: this.state.panOffset - 20});
            } else if (ev.deltaX > 0) {
                this.setState({panOffset: this.state.panOffset + 20});
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    }
}

/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import dayjs from 'dayjs';
import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import ButtonBar from '../widgets/ButtonBar';
import Input from '../widgets/Input';

import './style/FixedTimeline.css';

export default class FixedTimeline extends React.Component {
    static propTypes = {
        children: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dataEndTime: PropTypes.object,
        dataStartTime: PropTypes.object,
        dateFormat: PropTypes.string,
        dialogWidth: PropTypes.number,
        endTime: PropTypes.object,
        setEndTime: PropTypes.func,
        setStartTime: PropTypes.func,
        startTime: PropTypes.object,
        timeSpan: PropTypes.number
    };
    state = {
        ticksContainerEl: null,
        timelineWidth: 0
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.state.ticksContainerEl && (this.props.dialogWidth !== prevProps.dialogWidth || !prevState.ticksContainerEl)) {
            this.setState((state) => ({timelineWidth: state.ticksContainerEl.getBoundingClientRect().width}));
        }
        // Automatically pan if nearing the start/end of timeline
        if (this.props.currentTimestamp > this.props.endTime - 0.1 * this.props.timeSpan) {
            if (this.props.endTime - this.props.currentTimestamp > 0) {
                this.pan(+1);
            }
        } else if (this.props.currentTimestamp < this.props.startTime + 0.1 * this.props.timeSpan) {
            if (this.props.currentTimestamp - this.props.startTime > 0) {
                this.pan(-1);
            }
        }
    }
    render() {
        const navButtons = [
            {key: "home", tooltip: LocaleUtils.trmsg("timemanager.home"), icon: "home"},
            {key: "zoomout", tooltip: LocaleUtils.trmsg("timemanager.zoomout"), icon: "zoomout"},
            {key: "zoomin", tooltip: LocaleUtils.trmsg("timemanager.zoomin"), icon: "zoomin"}
        ];
        return (
            <div className="fixtimeline">
                <div className="fixtimeline-toolbar">
                    <div><Input onChange={this.props.setStartTime} type="date" value={this.props.startTime.format('YYYY-MM-DD')} /></div>
                    <div className="fixtimeline-toolbar-spacer" />
                    <ButtonBar buttons={navButtons} onClick={this.navButtonClicked} />
                    <div className="fixtimeline-toolbar-spacer" />
                    <div><Input onChange={this.props.setEndTime} type="date" value={this.props.endTime.format('YYYY-MM-DD')} /></div>
                </div>
                <div className="fixtimeline-slider">
                    <button className="button fixtimeline-pan-left" disabled={this.props.startTime.isSame(this.props.dataStartTime)} onMouseDown={() => this.startPan(-1)}>
                        <Icon icon="chevron-left" />
                    </button>
                    <div className="fixtimeline-ticks" ref={this.setTicksContainerRef}>
                        {this.renderTicks()}
                    </div>
                    <button className="button fixtimeline-pan-right" disabled={this.props.endTime.isSame(this.props.dataEndTime)} onMouseDown={() => this.startPan(1)}>
                        <Icon icon="chevron-right" />
                    </button>
                </div>
                {/* Render the slider component passed from the parent */}
                {this.props.children(
                    (time) => FixedTimeline.computePixelFromTime(this, time),
                    (pixel) => FixedTimeline.computeTimeFromPixel(this, pixel)
                )}
            </div>
        );
    }
    navButtonClicked = (key) => {
        if (key === "home") {
            this.props.setStartTime(null);
            this.props.setEndTime(null);
        } else if (key === "zoomin") {
            const mid = 0.5 * (this.props.startTime + this.props.endTime);
            this.props.setStartTime(mid - 0.25 * this.props.timeSpan);
            this.props.setEndTime(mid + 0.25 * this.props.timeSpan);
        } else if (key === "zoomout") {
            const mid = 0.5 * (this.props.startTime + this.props.endTime);
            const newStartTime = Math.max(this.props.dataStartTime, mid - this.props.timeSpan);
            this.props.setStartTime(newStartTime);
            this.props.setEndTime(Math.min(this.props.dataEndTime, newStartTime + 2 * this.props.timeSpan));
        }
    };
    pan = (dir) => {
        const delta = 0.1 * this.props.timeSpan;
        if (dir > 0) {
            if (this.props.dataEndTime - this.props.endTime > 0) {
                const newEndTime = Math.min(this.props.dataEndTime, this.props.endTime + delta);
                this.props.setStartTime(newEndTime - this.props.timeSpan);
                this.props.setEndTime(newEndTime);
            }
        } else {
            if (this.props.startTime - this.props.dataStartTime > 0) {
                const newStartTime = Math.max(this.props.dataStartTime, this.props.startTime - delta);
                this.props.setStartTime(newStartTime);
                this.props.setEndTime(newStartTime + this.props.timeSpan);
            }
        }
    };
    startPan = (dir) => {
        this.pan(dir);
        let panInterval = null;
        const panTimeout = setTimeout(() => {
            this.pan(dir);
            panInterval = setInterval(() => {
                this.pan(dir);
            }, 50);
        }, 250);
        document.addEventListener("mouseup", () => {
            clearInterval(panInterval);
            clearTimeout(panTimeout);
        }, {once: true, capture: true});
    };
    setTicksContainerRef = (instance) => {
        if (this.state.ticksContainerEl !== instance) {
            this.setState({ticksContainerEl: instance});
        }
    };
    renderTicks = () => {
        // Render approx 1 tick every 100 px
        const nTicks = Math.round(this.state.timelineWidth / 100);
        const tickInterval =  this.state.timelineWidth  / nTicks;
        const ticks = [];
        for (let x = 0; x < this.state.timelineWidth - 0.5 * tickInterval; x += tickInterval) {
            ticks.push({
                pixel: x,
                time: FixedTimeline.computeTimeFromPixel(this, x)
            });
        }
        ticks.push({
            pixel: this.state.timelineWidth,
            time: this.props.endTime
        });

        // Render ticks
        return ticks.map(tick => {
            const style = {
                left: (tick.pixel - 1) + "px"
            };
            return (
                <span className={tick.time ? "fixtimeline-ltick" : "fixtimeline-tick"} key={"tick" + tick.pixel} style={style}>
                    {tick.time ? (<span>{dayjs(tick.time).format(this.props.dateFormat)}</span>) : null}
                </span>
            );
        });
    };
    static computeTimeFromPixel(self, pixel) {
        return self.props.startTime + pixel / self.state.timelineWidth * self.props.timeSpan;
    }
    static computePixelFromTime(self, time) {
        return (time - self.props.startTime) / self.props.timeSpan * self.state.timelineWidth;
    }
}

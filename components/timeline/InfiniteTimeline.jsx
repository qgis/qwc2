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
import Icon from '../Icon';
import ButtonBar from '../widgets/ButtonBar';
import NumberInput from '../widgets/NumberInput';
import LocaleUtils from '../../utils/LocaleUtils';
import './style/InfiniteTimeline.css';


export default class InfiniteTimeline extends React.Component {
    static propTypes = {
        children: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dialogWidth: PropTypes.number,
        endTime: PropTypes.object,
        setMarkersCanBeEnabled: PropTypes.func,
        startTime: PropTypes.object,
        timeSpan: PropTypes.number
    }
    state = {
        timelineContainerEl: null,
        timelineWidth: 0,
        timeScale: 1,
        panOffset: 0,
        zoomFactor: 1 // 1 = [startTime, endTime] fits dialog width in linear scale,
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.timelineContainerEl && (this.props.dialogWidth !== prevProps.dialogWidth || !prevState.timelineContainerEl)) {
            this.setState({timelineWidth: this.state.timelineContainerEl.getBoundingClientRect().width});
        }
    }
    render() {
        const navButtons = [
            {key: "home", tooltip: LocaleUtils.trmsg("timemanager.home"), icon: "home"},
            {key: "zoomout", tooltip: LocaleUtils.trmsg("timemanager.zoomout"), icon: "zoomout"},
            {key: "zoomin", tooltip: LocaleUtils.trmsg("timemanager.zoomin"), icon: "zoomin"}
        ];

        return (
            <div className="inftimeline" onWheel={this.onSliderWheel} ref={this.setTimelineContainerRef}>
                <div className="inftimeline-toolbar">
                    <ButtonBar buttons={navButtons} onClick={this.navButtonClicked} />
                    <div className="inftimeline-toolbar-block">
                        <span>{LocaleUtils.tr("timemanager.timelinescale")}: &nbsp;</span>
                        <NumberInput decimals={2} max={10} min={0.01} onChange={this.setTimeScale} value={this.state.timeScale} />
                    </div>
                    <div className="inftimeline-toolbar-spacer" />
                </div>
                <div className="inftimeline-clip">
                    <button className="button inftimeline-pan-left" onMouseDown={() => this.pan(-20)}>
                        <Icon icon="chevron-left" />
                    </button>
                    <div className="inftimeline-ticks">
                        {this.renderTicks()}
                    </div>
                    <button className="button inftimeline-pan-right" onMouseDown={() => this.pan(20)}>
                        <Icon icon="chevron-right" />
                    </button>
                </div>
                {/* Render the slider component passed from the parent */}
                {this.props.children(
                    (time) => InfiniteTimeline.computePixelFromTime(this, time),
                    (pixel) => InfiniteTimeline.computeTimeFromPixel(this, pixel)
                )}
            </div>
        );
    }
    setTimelineContainerRef = (instance) => {
        if (this.state.timelineContainerEl !== instance) {
            this.setState({timelineContainerEl: instance});
        }
    }
    renderTicks = () => {
        const width = this.state.timelineWidth;
        const now = dayjs(this.props.currentTimestamp);
        const xnow = 0.5 * width - this.state.panOffset;

        // Render one tick every 100px
        const ticks = [{
            pixel: xnow,
            time: now
        }];
        // Compute ticks before current time
        let x = xnow;
        x -= 100;
        while (x >= 0) {
            if (x < width) {
                ticks.push({
                    pixel: x,
                    time: InfiniteTimeline.computeTimeFromPixel(this, x)
                });
            }
            x -= 100;
        }
        // Compute ticks after current time
        x = xnow;
        x += 100;
        while (x <= width) {
            if (x > 0) {
                ticks.push({
                    pixel: x,
                    time: InfiniteTimeline.computeTimeFromPixel(this, x)
                });
            }
            x += 100;
        }
        // Intermediate ticks (lines only)
        const b = this.state.timeScale;
        const tickPos = [20, 40, 60, 80].map(p => Math.pow(p / 100, 1 / b) * 100);
        let i = 0;
        for (x = xnow; x - tickPos[i] >= 0;) {
            if (x - tickPos[i] < width) {
                ticks.push({pixel: x - tickPos[i]});
            }
            i += 1;
            if (i >= tickPos.length) {
                x -= 100;
                i = 0;
            }
        }
        i = 0;
        for (x = xnow; x + tickPos[i] <= width;) {
            if (x + tickPos[i] > 0) {
                ticks.push({pixel: x + tickPos[i]});
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
                left: (tick.pixel - 1) + "px"
            };
            return (
                <span className={tick.time ? "inftimeline-ltick" : "inftimeline-tick"} key={"tick" + tick.pixel} style={style}>
                    {tick.time ? (<span>{dayjs(tick.time).format("YYYY-MM-DD[\n]HH:mm:ss")}</span>) : null}
                </span>
            );
        });
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
    navButtonClicked = (key) => {
        if (key === "home") {
            this.setState({panOffset: 0, zoomFactor: 1});
        } else if (key === "zoomin") {
            this.setState({zoomFactor: this.state.zoomFactor * 0.5});
        } else if (key === "zoomout") {
            this.setState({zoomFactor: this.state.zoomFactor * 2});
        }
    }
    setTimeScale = (value) => {
        this.props.setMarkersCanBeEnabled(value === 1);
        this.setState({timeScale: value});
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
    static computeTimeFromPixel(self, pixel) {
        const exp = self.state.timeScale;
        const dpx = self.state.panOffset + pixel - 0.5 * self.state.timelineWidth;
        return self.props.currentTimestamp + Math.sign(dpx) * Math.pow(Math.abs(dpx) / (0.5 * self.state.timelineWidth), exp) * 0.5 * self.props.timeSpan * self.state.zoomFactor;
    }
    static computePixelFromTime(self, time) {
        const dt = time - self.props.currentTimestamp;
        const iexp = 1 / self.state.timeScale;
        return 0.5 * self.state.timelineWidth * (1 + Math.sign(dt) * Math.pow(Math.abs(dt) / (0.5 * self.props.timeSpan * self.state.zoomFactor), iexp)) - self.state.panOffset;
    }
}

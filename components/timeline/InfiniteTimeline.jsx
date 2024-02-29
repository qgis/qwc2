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
import NumberInput from '../widgets/NumberInput';

import './style/InfiniteTimeline.css';


export default class InfiniteTimeline extends React.Component {
    static propTypes = {
        children: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dateFormat: PropTypes.string,
        dialogWidth: PropTypes.number,
        endTime: PropTypes.object,
        setMarkersCanBeEnabled: PropTypes.func,
        startTime: PropTypes.object,
        timeSpan: PropTypes.number
    };
    state = {
        timelineContainerEl: null,
        timelineWidth: 0,
        timeScalePast: 1,
        timeScaleFuture: 1,
        panOffset: 0,
        zoomFactor: 1 // 1 = [startTime, endTime] fits dialog width in linear scale,
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.state.timelineContainerEl && (this.props.dialogWidth !== prevProps.dialogWidth || !prevState.timelineContainerEl)) {
            this.setState((state) => ({timelineWidth: state.timelineContainerEl.getBoundingClientRect().width}));
        }
        if (this.props.currentTimestamp !== prevProps.currentTimestamp) {
            const pixel = InfiniteTimeline.computePixelFromTime(this, this.props.currentTimestamp);
            if (pixel < 0 || pixel >= this.state.timelineWidth) {
                this.setState({panOffset: 0});
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
            <div className="inftimeline" onWheel={this.onSliderWheel} ref={this.setTimelineContainerRef}>
                <div className="inftimeline-toolbar">
                    <ButtonBar buttons={navButtons} onClick={this.navButtonClicked} />
                    <div className="inftimeline-toolbar-block">
                        <span>{LocaleUtils.tr("timemanager.timelinescale")}: &nbsp;</span>
                        <Icon icon="before" title={LocaleUtils.tr("timemanager.past")} />
                        <NumberInput decimals={2} max={10} min={0.01} onChange={this.setTimeScalePast} value={this.state.timeScalePast} />
                        <Icon icon="after" title={LocaleUtils.tr("timemanager.future")} />
                        <NumberInput decimals={2} max={10} min={0.01} onChange={this.setTimeScaleFuture} value={this.state.timeScaleFuture} />
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
    };
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
        let tickPos = [20, 40, 60, 80].map(p => Math.pow(p / 100, 1 / this.state.timeScalePast) * 100);
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
        tickPos = [20, 40, 60, 80].map(p => Math.pow(p / 100, 1 / this.state.timeScaleFuture) * 100);
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
                    {tick.time ? (<span>{dayjs(tick.time).format(this.props.dateFormat)}</span>) : null}
                </span>
            );
        });
    };
    onSliderWheel = (ev) => {
        if (ev.shiftKey) {
            if (ev.deltaY < 0) {
                this.setState((state) => ({zoomFactor: state.zoomFactor * 0.5}));
            } else if (ev.deltaY > 0) {
                this.setState((state) => ({zoomFactor: state.zoomFactor * 2}));
            }
        } else {
            if (ev.deltaX < 0) {
                this.setState((state) => ({panOffset: state.panOffset - 20}));
            } else if (ev.deltaX > 0) {
                this.setState((state) => ({panOffset: state.panOffset + 20}));
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    };
    navButtonClicked = (key) => {
        if (key === "home") {
            this.setState({panOffset: 0, zoomFactor: 1});
        } else if (key === "zoomin") {
            this.setState((state) => ({zoomFactor: state.zoomFactor * 0.5}));
        } else if (key === "zoomout") {
            this.setState((state) => ({zoomFactor: state.zoomFactor * 2}));
        }
    };
    setTimeScalePast = (value) => {
        this.props.setMarkersCanBeEnabled(value === 1 && this.state.timeScaleFuture === 1);
        this.setState({timeScalePast: value});
    };
    setTimeScaleFuture = (value) => {
        this.props.setMarkersCanBeEnabled(this.state.timeScalePast === 1 && value === 1);
        this.setState({timeScaleFuture: value});
    };
    pan = (offset) => {
        this.setState((state) => ({panOffset: state.panOffset + offset}));
        let panInterval = null;
        const panTimeout = setTimeout(() => {
            this.setState((state) => ({panOffset: state.panOffset + offset}));
            panInterval = setInterval(() => {
                this.setState((state) => ({panOffset: state.panOffset + offset}));
            }, 50);
        }, 250);
        document.addEventListener("mouseup", () => {
            clearInterval(panInterval);
            clearTimeout(panTimeout);
        }, {once: true, capture: true});
    };
    static computeTimeFromPixel(self, pixel) {
        const dpx = self.state.panOffset + pixel - 0.5 * self.state.timelineWidth;
        const exp = pixel - 0.5 * self.state.timelineWidth < 0 ? self.state.timeScalePast : self.state.timeScaleFuture;
        return self.props.currentTimestamp + Math.sign(dpx) * Math.pow(Math.abs(dpx) / (0.5 * self.state.timelineWidth), exp) * 0.5 * self.props.timeSpan * self.state.zoomFactor;
    }
    static computePixelFromTime(self, time) {
        const dt = time - self.props.currentTimestamp;
        const iexp = dt < 0 ? 1 / self.state.timeScalePast : 1 / self.state.timeScaleFuture;
        return 0.5 * self.state.timelineWidth * (1 + Math.sign(dt) * Math.pow(Math.abs(dt) / (0.5 * self.props.timeSpan * self.state.zoomFactor), iexp)) - self.state.panOffset;
    }
}

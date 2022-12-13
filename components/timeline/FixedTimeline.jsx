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
import DateInput from '../widgets/DateInput';
import './style/FixedTimeline.css';

export default class FixedTimeline extends React.Component {
    static propTypes = {
        children: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dateFormat: PropTypes.string,
        dialogWidth: PropTypes.number,
        endTime: PropTypes.object,
        setEndTime: PropTypes.func,
        setStartTime: PropTypes.func,
        startTime: PropTypes.object,
        timeSpan: PropTypes.number
    }
    state = {
        ticksContainerEl: null,
        timelineWidth: 0
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.ticksContainerEl && (this.props.dialogWidth !== prevProps.dialogWidth || !prevState.ticksContainerEl)) {
            this.setState({timelineWidth: this.state.ticksContainerEl.getBoundingClientRect().width});
        }
    }
    render() {
        return (
            <div className="fixtimeline">
                <div className="fixtimeline-toolbar">
                    <div><DateInput onChange={this.props.setStartTime} value={this.props.startTime.format('YYYY-MM-DD')} /></div>
                    <div className="fixtimeline-toolbar-spacer" />
                    <div><DateInput onChange={this.props.setEndTime} value={this.props.endTime.format('YYYY-MM-DD')} /></div>
                </div>
                <div className="fixtimeline-ticks" ref={this.setTicksContainerRef}>
                    {this.renderTicks()}
                </div>
                {/* Render the slider component passed from the parent */}
                {this.props.children(
                    (time) => FixedTimeline.computePixelFromTime(this, time),
                    (pixel) => FixedTimeline.computeTimeFromPixel(this, pixel)
                )}
            </div>
        );
    }
    setTicksContainerRef = (instance) => {
        if (this.state.ticksContainerEl !== instance) {
            this.setState({ticksContainerEl: instance});
        }
    }
    renderTicks = () => {
        // Render approx 1 tick every 100 px
        const nTicks = Math.round(this.state.timelineWidth / 100);
        const tickInterval =  this.state.timelineWidth  / nTicks;
        const tickSubinterval = tickInterval / 5;
        const ticks = [];
        for (let x = 0; x < this.state.timelineWidth - 0.5 * tickInterval; x += tickInterval) {
            ticks.push({
                pixel: x,
                time: FixedTimeline.computeTimeFromPixel(this, x)
            });
            for (let i = 1; i < 5; ++i) {
                ticks.push({
                    pixel: x + i * tickSubinterval
                });
            }
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
    }
    static computeTimeFromPixel(self, pixel) {
        return self.props.startTime + pixel / self.state.timelineWidth * self.props.timeSpan;
    }
    static computePixelFromTime(self, time) {
        return (time - self.props.startTime) / self.props.timeSpan * self.state.timelineWidth;
    }
}

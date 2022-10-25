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
import isEmpty from 'lodash.isempty';
import './style/Timeline.css';


export default class Timeline extends React.Component {
    static propTypes = {
        currentTimestamp: PropTypes.number,
        enabled: PropTypes.bool,
        endTime: PropTypes.object,
        gradientSteps: PropTypes.array,
        startTime: PropTypes.object,
        stepSizeUnit: PropTypes.string,
        timestampChanged: PropTypes.func
    }
    state = {
        currentTimestampDrag: null // Only when dragging
    }
    render() {
        // Time span, in seconds
        const deltaT = this.props.endTime.diff(this.props.startTime);
        const perc = (dayjs(this.state.currentTimestampDrag || this.props.currentTimestamp).diff(this.props.startTime) / deltaT * 100).toFixed(2) + "%";
        const cursorStyle = {
            left: perc
        };
        const labelStyle = {
            transform: "translateX(-" + perc + ")"
        };

        const sliderStyle = {};
        if (this.props.enabled && !isEmpty(this.props.gradientSteps)) {
            sliderStyle.background = 'linear-gradient(90deg, ' + this.props.gradientSteps.join(", ") + ')';
        }
        return (
            <div className="timeline">
                <div className="timeline-slider" onMouseDown={this.pickCurrentTimestamp} style={sliderStyle} />
                {this.props.enabled ? (
                    <div className="timeline-cursor" style={cursorStyle}>
                        <div className="timeline-cursor-label" style={labelStyle}>
                            {dayjs(this.state.currentTimestampDrag || this.props.currentTimestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }
    pickCurrentTimestamp = (event) => {
        const target = event.currentTarget;

        const computeTimestamp = (ev) => {
            if (!this.props.enabled) {
                return;
            }
            const pos = ev.clientX;
            const rect = target.getBoundingClientRect();
            const perc = (pos - rect.left) / rect.width;
            const deltaT = this.props.endTime.diff(this.props.startTime);
            let currentTimestamp = this.props.startTime.add(perc * deltaT, 'ms');
            // Snap to configured step interval
            let add = null;
            if (this.props.stepSizeUnit.endsWith("m")) {
                add = currentTimestamp.second() > 30;
                currentTimestamp = currentTimestamp.second(0);
            } else if (this.props.stepSizeUnit.endsWith("h")) {
                add = currentTimestamp.minute() > 30;
                currentTimestamp = currentTimestamp.second(0).minute(0);
            } else if (this.props.stepSizeUnit.endsWith("d")) {
                add = currentTimestamp.hour() > 12;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0);
            } else if (this.props.stepSizeUnit.endsWith("M")) {
                add = currentTimestamp.day() > 15;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0).date(1);
            } else if (this.props.stepSizeUnit.endsWith("y")) {
                add = currentTimestamp.month() > 5;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0).date(1).month(0);
            }
            if (add) {
                const num = parseInt(this.props.stepSizeUnit.slice(0, -1), 10) || 1;
                currentTimestamp = currentTimestamp.add(num, this.props.stepSizeUnit.slice(-1));
            }
            this.setState({currentTimestampDrag: currentTimestamp});
        };
        document.addEventListener("mousemove", computeTimestamp);
        document.addEventListener("mouseup", () => {
            if (this.state.currentTimestampDrag) {
                this.props.timestampChanged(+this.state.currentTimestampDrag);
                this.setState({currentTimestampDrag: null});
            }
            document.removeEventListener("mousemove", computeTimestamp);
        }, {once: true, capture: true});
        computeTimestamp(event);
    }
}

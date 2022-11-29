/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import dayjs from 'dayjs';
import {addLayerFeatures, removeLayer, LayerRole} from '../actions/layers';
import Icon from './Icon';
import ButtonBar from './widgets/ButtonBar';
import NumberInput from './widgets/NumberInput';
import LocaleUtils from '../utils/LocaleUtils';
import './style/ContinuousTimeline.css';


class ContinuousTimeline extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dialogWidth: PropTypes.number, // Just to trigger a re-render when the width changes
        enabled: PropTypes.bool,
        endTime: PropTypes.object,
        removeLayer: PropTypes.func,
        startTime: PropTypes.object,
        stepSizeUnit: PropTypes.string,
        timeFeatures: PropTypes.object,
        timestampChanged: PropTypes.func
    }
    state = {
        ticksContainer: null,
        currentTimestampDrag: null,
        highlightFeature: null,
        panOffset: 0, // pixels
        timeScale: 1,
        zoomFactor: 1 // 1 = [startTime, endTime] fits dialog width in linear scale
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.highlightFeature !== prevState.highlightFeature) {
            if (!this.state.highlightFeature) {
                this.props.removeLayer("ctimelinehighlight");
            } else {
                const layer = {
                    id: "ctimelinehighlight",
                    role: LayerRole.MARKER,
                    rev: +new Date()
                };
                this.props.addLayerFeatures(layer, [this.state.highlightFeature], true);
            }
        }
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
                        <NumberInput decimals={2} max={10} min={0.01} onChange={(value) => this.setState({timeScale: value})} value={this.state.timeScale} />
                    </div>
                    <div className="ctimeline-toolbar-spacer" />
                </div>
                <div className="ctimeline-clip">
                    <button className="button ctimeline-pan-left" onMouseDown={() => this.pan(-20)}>
                        <Icon icon="chevron-left" />
                    </button>
                    <div className="ctimeline-ticks" ref={this.setTicksRef}>
                        {this.renderTicks()}
                    </div>
                    <button className="button ctimeline-pan-right" onMouseDown={() => this.pan(20)}>
                        <Icon icon="chevron-right" />
                    </button>
                </div>
                <div className="ctimeline-slider-container">
                    <div className="ctimeline-slider" onMouseDown={this.pickCurrentTimestamp}>
                        {this.renderTimeFeatures()}
                    </div>
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
    renderTimeFeatures = () => {
        if (!this.state.ticksContainer) {
            return null;
        }

        const rect = this.state.ticksContainer.getBoundingClientRect();
        const mid = 0.5 * rect.width - this.state.panOffset;
        const ib = 1 / this.state.timeScale;
        const dt = 0.5 * this.props.endTime.diff(this.props.startTime) * this.state.zoomFactor;
        let top = 20;

        return Object.entries(this.props.timeFeatures.features).map(([layer, features]) => {
            return (
                <div key={layer}>
                    <div className="ctimeline-slider-layertitle">{layer}</div>
                    {features.map(feature => {

                        const tstart = feature.properties.startdate;
                        const tend = feature.properties.enddate;

                        const left = mid + 0.5 * rect.width * Math.sign(tstart - this.props.currentTimestamp) * Math.pow(Math.abs(tstart - this.props.currentTimestamp) / dt, ib);
                        const right = mid + 0.5 * rect.width * Math.sign(tend - this.props.currentTimestamp) * Math.pow(Math.abs(tend - this.props.currentTimestamp) / dt, ib);

                        const style = {
                            top: top + "px",
                            left: left + "px",
                            width: (right - left) + "px"
                        };
                        top += 26;

                        const title = tstart.format("YYYY-MM-DD HH:mm:ss") + " - " + tend.format("YYYY-MM-DD HH:mm:ss");

                        return (
                            <div className="ctimeline-slider-feature" key={feature.id}
                                onMouseEnter={() => this.setState({highlightFeature: feature})}
                                onMouseLeave={() => this.setState({highlightFeature: this.state.highlightFeature === feature ? null : this.state.highlightFeature})}
                                style={style} title={title}>{feature.properties[feature.displayfield]}
                            </div>
                        );
                    })}
                </div>
            );
        });
    }
}

export default connect(() => ({}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer
})(ContinuousTimeline);

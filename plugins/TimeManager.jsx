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
import utc from 'dayjs/plugin/utc';
import {setLayerDimensions} from '../actions/layers';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import Icon from '../components/Icon';
import ButtonBar from '../components/widgets/ButtonBar';
import NumberInput from '../components/widgets/NumberInput';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/TimeManager.css';


dayjs.extend(utc);

class TimeManager extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        layerUUIds: PropTypes.object,
        layers: PropTypes.array,
        setCurrentTask: PropTypes.func,
        setLayerDimensions: PropTypes.func
    }
    static defaultState = {
        animationActive: false,
        animationInterval: 1,
        stepSize: 1,
        stepSizeUnit: 'd', // 1 day
        timeEnabled: false,
        timeData: {
            layerDimensions: {},
            values: []
        },
        currentTimestamp: "",
        settingsPopup: false,
        visible: false,
        startDate: null,
        endDate: null
    }
    constructor(props) {
        super(props);
        this.state = TimeManager.defaultState;
        this.animationTimer = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.state.visible && prevState.visible) {
            this.setState(TimeManager.defaultState);
        }
        if (!prevProps.active && this.props.active) {
            this.setState({visible: true});
        }
        if (this.props.layerUUIds !== prevProps.layerUUIds) {
            this.stopAnimation();
            const timeData = {
                layerDimensions: {},
                values: new Set()
            };
            this.props.layers.forEach(layer => {
                if (layer.type === "wms") {
                    const layertimeData = LayerUtils.getTimeDimensionValues(layer);
                    timeData.layerDimensions[layer.id] = [...layertimeData.names];
                    layertimeData.values.forEach(x => timeData.values.add(x));
                }
            });
            timeData.values = [...timeData.values].sort().map(d => dayjs.utc(d));
            this.setState({timeData: timeData});
            this.updateLayerTimeDimensions(timeData.layerDimensions, this.state.currentTimestamp);
        }
        if (this.state.currentTimestamp !== prevState.currentTimestamp || this.state.timeEnabled !== prevState.timeEnabled) {
            this.updateLayerTimeDimensions(this.state.timeData.layerDimensions, this.state.currentTimestamp);
        }
        if (this.state.animationActive && this.state.animInterval !== prevState.animInterval) {
            this.stopAnimation();
        }
    }
    render() {
        if (!this.state.visible) {
            return null;
        }
        const timeValues = this.state.timeData.values;
        let body = null;
        if (timeValues.length < 2) {
            body = (<div role="body"><div className="time-manager-notemporaldata">{LocaleUtils.tr("timemanager.notemporaldata")}</div></div>);
        } else {
            body = this.renderBody(timeValues);
        }
        return (
            <ResizeableWindow dockable="bottom"  icon="time" initialHeight={140}
                initialWidth={800}  onClose={this.onClose}
                scrollable title={LocaleUtils.tr("timemanager.title")}>
                {body}
            </ResizeableWindow>
        );
    }
    renderBody = (timeValues) => {
        const timeButtons = [
            {key: "rewind", tooltip: LocaleUtils.trmsg("timemanager.rewind"), icon: "nav-start"},
            {key: "prev", tooltip: LocaleUtils.trmsg("timemanager.stepback"), icon: "nav-left"},
            {key: "stop", tooltip: LocaleUtils.trmsg("timemanager.stop"), icon: "square", disabled: !this.state.animationActive},
            {key: "play", tooltip: LocaleUtils.trmsg("timemanager.play"), icon: "triangle-right", disabled: this.state.animationActive},
            {key: "next", tooltip: LocaleUtils.trmsg("timemanager.stepfwd"), icon: "nav-right"}
        ];
        // Time span, in seconds
        const deltaT = this.getEndTime().diff(this.getStartTime());
        const perc = (dayjs(this.state.currentTimestamp).diff(this.getStartTime()) / deltaT * 100).toFixed(2) + "%";
        const cursorStyle = {
            left: perc
        };
        const labelStyle = {
            transform: "translateX(-" + perc + ")"
        };

        const options = (
            <div className="time-manager-options">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("timemanager.stepsize")}:</td>
                            <td>
                                <NumberInput max={100} min={1} onChange={value => this.setState({stepSize: value})} value={this.state.stepSize} />
                                <select onChange={ev => this.setState({stepSizeUnit: ev.target.value})} value={this.state.stepSizeUnit}>
                                    <option key="s" value="s">{LocaleUtils.tr("timemanager.unit.seconds")}</option>
                                    <option key="m" value="m">{LocaleUtils.tr("timemanager.unit.minutes")}</option>
                                    <option key="h" value="h">{LocaleUtils.tr("timemanager.unit.hours")}</option>
                                    <option key="d" value="d">{LocaleUtils.tr("timemanager.unit.days")}</option>
                                    <option key="M" value="M">{LocaleUtils.tr("timemanager.unit.months")}</option>
                                    <option key="y" value="y">{LocaleUtils.tr("timemanager.unit.years")}</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("timemanager.animationinterval")}:</td>
                            <td>
                                <NumberInput max={10} min={1} onChange={value => this.setState({animationInterval: value})} value={this.state.animationInterval} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );

        return (
            <div className="time-manager-body" role="body">
                <div className="time-manager-toolbar">
                    <span>{LocaleUtils.tr("timemanager.toggle")}</span>
                    <ToggleSwitch active={this.state.timeEnabled} onChange={this.toggleTimeEnabled} />
                    <ButtonBar buttons={timeButtons} disabled={!this.state.timeEnabled} onClick={this.animationButtonClicked} />
                    <span className="time-manager-toolbar-spacer" />
                    <span className="time-manager-options-menubutton">
                        <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState({settingsPopup: !this.state.settingsPopup})}>
                            <Icon icon="cog" />
                        </button>
                        {this.state.settingsPopup ? options : null}
                    </span>
                </div>
                <div className="time-manager-timeline">
                    <div className="time-manager-time-blocks" onClick={this.pickCurrentTimestamp} />
                    {this.state.timeEnabled ? (
                        <div className="time-manager-cursor" style={cursorStyle}>
                            <div className="time-manager-cursor-label" style={labelStyle}>
                                {dayjs(this.state.currentTimestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
                            </div>
                        </div>
                    ) : null}
                    <div className="time-manager-ticks">
                        <div><input onChange={this.setStartTime} type="date" value={(this.state.startDate || timeValues[0]).format('YYYY-MM-DD')} /></div>
                        <div><input onChange={this.setEndTime} type="date" value={(this.state.endDate || timeValues[timeValues.length - 1]).format('YYYY-MM-DD')} /></div>
                    </div>
                </div>
            </div>
        );
    }
    toggleTimeEnabled = (enabled) => {
        clearInterval(this.animationTimer);
        this.animationTimer = null;
        this.setState({timeEnabled: enabled, currentTimestamp: (+this.getStartTime()) || 0, animationActive: false});
    }
    pickCurrentTimestamp = (ev) => {
        if (!this.state.timeEnabled) {
            return;
        }
        const pos = ev.clientX;
        const rect = ev.currentTarget.getBoundingClientRect();
        const perc = (pos - rect.left) / rect.width;
        const deltaT = this.getEndTime().diff(this.getStartTime());
        const currentTimestamp = this.getStartTime().add(perc * deltaT, 'ms');
        this.setState({currentTimestamp: currentTimestamp});
    }
    animationButtonClicked = (action) => {
        this.stopAnimation();
        if (action === "rewind") {
            this.setState({currentTimestamp: (+this.getStartTime()) || 0, animationActive: false});
        } else if (action === "prev") {
            const newday = this.step(-1);
            this.setState({currentTimestamp: +Math.max(newday, this.getStartTime())});
        } else if (action === "next") {
            const newday = this.step(+1);
            this.setState({currentTimestamp: +Math.min(newday, this.getEndTime())});
        } else if (action === "stop") {
            /* Already stopped above, pass */
        } else if (action === "play") {
            this.animationTimer = setInterval(() => {
                this.advanceAnimation();
            }, 1000 * this.state.animationInterval);
            this.setState({animationActive: true});
        }
    }
    advanceAnimation = () => {
        const newday = this.step(+1);
        const lastday = this.getEndTime();
        if (newday > lastday) {
            this.setState({currentTimestamp: +lastday, animationActive: false});
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        } else {
            this.setState({currentTimestamp: +newday});
        }
    }
    stopAnimation = () => {
        if (this.state.animationActive) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
            this.setState({animationActive: false});
        }
    }
    onClose = () => {
        this.toggleTimeEnabled(false);
        this.setState({visible: false});
    }
    step = (direction) => {
        const day = dayjs(this.state.currentTimestamp);
        const newday = day.add(direction * this.state.stepSize, this.state.stepSizeUnit);
        if (this.state.stepSizeUnit === "m") {
            return newday.second(0);
        } else if (this.state.stepSizeUnit === "h") {
            return newday.second(0).minute(0);
        } else if (this.state.stepSizeUnit === "d") {
            return newday.second(0).minute(0).hour(0);
        } else if (this.state.stepSizeUnit === "M") {
            return newday.second(0).minute(0).hour(0).date(1);
        } else if (this.state.stepSizeUnit === "y") {
            return newday.second(0).minute(0).hour(0).date(1).month(0);
        }
        return newday;
    }
    updateLayerTimeDimensions = (timeDimensions, currentTimestamp) => {
        const currentTime = this.state.timeEnabled ? new Date(currentTimestamp).toISOString() : undefined;
        this.props.layers.forEach(layer => {
            if (layer.id in timeDimensions) {
                const dimensions = timeDimensions[layer.id].reduce((res, dimension) => {
                    res[dimension.toUpperCase()] = currentTime;
                    return res;
                }, {...(layer.dimensionValues || {})});
                this.props.setLayerDimensions(layer.id, dimensions);
            }
        });
    }
    getStartTime = () => {
        const date = this.state.startDate || this.state.timeData.values[0];
        return date.hour(0).minute(0).second(0);
    }
    getEndTime = () => {
        const date = (this.state.endDate || this.state.timeData.values[this.state.timeData.values.length - 1]);
        return date.hour(23).minute(59).second(59);
    }
    setStartTime = (ev) => {
        const date = (ev.target.value ? dayjs.utc(ev.target.value) : this.state.timeData.values[0]).hour(0).minute(0).second(0);
        if (date < this.getEndTime()) {
            this.setState({startDate: date});
        }
    }
    setEndTime = (ev) => {
        const date = (ev.target.value ? dayjs.utc(ev.target.value) : this.state.timeData.values[this.state.timeData.values.length - 1]).hour(23).minute(59).second(59);
        if (date > this.getStartTime()) {
            this.setState({endDate: date});
        }
    }
}

export default connect((state) => ({
    active: state.task.id === "TimeManager",
    layers: state.layers.flat,
    layerUUIds: state.layers.uuids
}), {
    setLayerDimensions: setLayerDimensions,
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TimeManager);

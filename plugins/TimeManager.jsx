/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import uuid from 'uuid';
import isEqual from 'lodash.isequal';
import ol from 'openlayers';
import dateParser from 'any-date-parser';
import {setLayerDimensions, addLayerFeatures, removeLayer, LayerRole} from '../actions/layers';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import Icon from '../components/Icon';
import ButtonBar from '../components/widgets/ButtonBar';
import NumberInput from '../components/widgets/NumberInput';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ResizeableWindow from '../components/ResizeableWindow';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/TimeManager.css';
import markerIcon from '../utils/img/marker-icon.png';

dayjs.extend(utc);

class TimeManager extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerFeatures: PropTypes.func,
        layerVisibilities: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setLayerDimensions: PropTypes.func
    }
    static defaultState = {
        timeEnabled: false,
        startDate: null,
        endDate: null,
        currentTimestamp: "",
        currentTimestampDrag: null, // Only when dragging
        animationActive: false,
        animationInterval: 1,
        stepSize: 1,
        stepSizeUnit: 'd', // 1 day
        markersEnabled: false,
        timeMarkers: null,
        settingsPopup: false,
        visible: false
    }
    state = {
        timeData: {
            layerDimensions: {},
            values: [],
            attributes: {},
            ranges: []
        },
        ...TimeManager.defaultState
    }
    constructor(props) {
        super(props);
        this.animationTimer = null;
        this.updateMapMarkersTimeout = null;
        this.blockColors = [
            "#f7af7d", "#eacc6e", "#fef89a", "#c5e09b", "#a3d29c", "#7cc096", "#79c8c5", "#34afce"
        ];
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.state.visible && prevState.visible) {
            this.setState(TimeManager.defaultState);
        }
        if (!prevProps.active && this.props.active) {
            this.setState({visible: true});
            // Clear task immediately after showing, visibility is controlled by internal state
            this.props.setCurrentTask(null);
        }
        if (!isEqual(this.props.layerVisibilities, prevProps.layerVisibilities)) {
            this.stopAnimation();
            const timeData = {
                layerDimensions: {},
                values: new Set(),
                attributes: {},
                ranges: []
            };
            this.props.layers.forEach(layer => {
                if (layer.type === "wms") {
                    const layertimeData = LayerUtils.getTimeDimensionValues(layer);
                    if (layertimeData.names.size > 0) {
                        timeData.layerDimensions[layer.id] = [...layertimeData.names];
                        layertimeData.values.forEach(x => timeData.values.add(x));
                        timeData.attributes[layer.uuid] = {
                            ...timeData.attributes[layer.uuid],
                            ...layertimeData.attributes
                        };
                    }
                }
            });
            timeData.values = [...timeData.values].sort().map(d => dayjs.utc(d));
            if (timeData.values.length > 1) {
                const interval = timeData.values[timeData.values.length - 1].diff(timeData.values[0], 'minute');
                const blockInterval = interval / this.blockColors.length;
                timeData.ranges = this.blockColors.map((entry, idx) => {
                    return [
                        timeData.values[0].add(idx * blockInterval, 'minute'),
                        timeData.values[0].add((idx + 1) * blockInterval, 'minute')
                    ];
                });
            }
            this.setState({timeData: timeData});
            this.updateLayerTimeDimensions(timeData.layerDimensions, this.state.currentTimestamp);
            this.scheduleUpdateMapMarkers();
        }
        if (this.state.currentTimestamp !== prevState.currentTimestamp || this.state.timeEnabled !== prevState.timeEnabled) {
            this.updateLayerTimeDimensions(this.state.timeData.layerDimensions, this.state.currentTimestamp);
        }
        if (this.state.animationActive && this.state.animInterval !== prevState.animInterval) {
            this.stopAnimation();
        }
        if (
            this.props.map.bbox !== prevProps.map.bbox ||
            (this.state.visible && !prevState.visible) ||
            this.state.currentTimestamp !== prevState.currentTimestamp ||
            this.state.timeEnabled !== prevState.timeEnabled ||
            (this.state.markersEnabled && !prevState.markersEnabled)
        ) {
            this.scheduleUpdateMapMarkers();
        }
        if (!this.state.markersEnabled && prevState.markersEnabled) {
            this.props.removeLayer("timemarkers");
        }
        if (this.state.timeMarkers && this.state.timeMarkers !== prevState.timeMarkers && this.state.timeMarkers.pending === 0) {
            const layer = {
                id: "timemarkers",
                role: LayerRole.MARKER,
                styleFunction: this.markerStyle
            };
            this.props.addLayerFeatures(layer, this.state.timeMarkers.markers, true);
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
        const perc = (dayjs(this.state.currentTimestampDrag || this.state.currentTimestamp).diff(this.getStartTime()) / deltaT * 100).toFixed(2) + "%";
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
                                    <option value="s">{LocaleUtils.tr("timemanager.unit.seconds")}</option>
                                    <option value="m">{LocaleUtils.tr("timemanager.unit.minutes")}</option>
                                    <option value="h">{LocaleUtils.tr("timemanager.unit.hours")}</option>
                                    <option value="d">{LocaleUtils.tr("timemanager.unit.days")}</option>
                                    <option value="M">{LocaleUtils.tr("timemanager.unit.months")}</option>
                                    <option value="y">{LocaleUtils.tr("timemanager.unit.years")}</option>
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
                    <span className="time-manager-toolbar-block">
                        <span>{LocaleUtils.tr("timemanager.toggle")}</span>
                        <ToggleSwitch active={this.state.timeEnabled} onChange={this.toggleTimeEnabled} />
                    </span>
                    <ButtonBar buttons={timeButtons} disabled={!this.state.timeEnabled} onClick={this.animationButtonClicked} />
                    <span className="time-manager-toolbar-block">
                        <span>{LocaleUtils.tr("timemanager.markers")}</span>
                        <ToggleSwitch active={this.state.markersEnabled} onChange={value => this.setState({markersEnabled: value})} />
                    </span>
                    <span className="time-manager-toolbar-spacer" />
                    <span className="time-manager-options-menubutton">
                        <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState({settingsPopup: !this.state.settingsPopup})}>
                            <Icon icon="cog" />
                        </button>
                        {this.state.settingsPopup ? options : null}
                    </span>
                </div>
                <div className="time-manager-timeline">
                    <div className="time-manager-time-blocks" onMouseDown={this.pickCurrentTimestamp}>
                        {this.state.markersEnabled ? this.blockColors.map((color, i) => (<div key={"block" + i} style={{backgroundColor: color}} />)) : null}
                    </div>
                    {this.state.timeEnabled ? (
                        <div className="time-manager-cursor" style={cursorStyle}>
                            <div className="time-manager-cursor-label" style={labelStyle}>
                                {dayjs(this.state.currentTimestampDrag || this.state.currentTimestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
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
        clearTimeout(this.updateMapMarkersTimeout);
        this.animationTimer = null;
        this.updateMapMarkersTimeout = null;
        this.setState({timeEnabled: enabled, currentTimestamp: +this.getStartTime(), animationActive: false, timeMarkers: null});
    }
    pickCurrentTimestamp = (event) => {
        const target = event.currentTarget;

        const computeTimestamp = (ev) => {
            if (!this.state.timeEnabled) {
                return;
            }
            const pos = ev.clientX;
            const rect = target.getBoundingClientRect();
            const perc = (pos - rect.left) / rect.width;
            const deltaT = this.getEndTime().diff(this.getStartTime());
            let currentTimestamp = this.getStartTime().add(perc * deltaT, 'ms');
            // Snap to configured step interval
            let add = null;
            if (this.state.stepSizeUnit === "m") {
                add = currentTimestamp.second() > 30;
                currentTimestamp = currentTimestamp.second(0);
            } else if (this.state.stepSizeUnit === "h") {
                add = currentTimestamp.minute() > 30;
                currentTimestamp = currentTimestamp.second(0).minute(0);
            } else if (this.state.stepSizeUnit === "d") {
                add = currentTimestamp.hour() > 12;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0);
            } else if (this.state.stepSizeUnit === "M") {
                add = currentTimestamp.day() > 15;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0).date(1);
            } else if (this.state.stepSizeUnit === "y") {
                add = currentTimestamp.month() > 5;
                currentTimestamp = currentTimestamp.second(0).minute(0).hour(0).date(1).month(0);
            }
            if (add) {
                currentTimestamp = currentTimestamp.add(1, this.state.stepSizeUnit);
            }
            this.setState({currentTimestampDrag: currentTimestamp});
        };
        document.addEventListener("mousemove", computeTimestamp);
        document.addEventListener("mouseup", () => {
            if (this.state.currentTimestampDrag) {
                this.setState({currentTimestamp: this.state.currentTimestampDrag, currentTimestampDrag: null});
            }
            document.removeEventListener("mousemove", computeTimestamp);
        }, {once: true, capture: true});
        computeTimestamp(event);
    }
    animationButtonClicked = (action) => {
        this.stopAnimation();
        if (action === "rewind") {
            this.setState({currentTimestamp: +this.getStartTime(), animationActive: false});
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
        this.props.removeLayer("timemarkers");
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
        return date ? date.hour(0).minute(0).second(0) : 0;
    }
    getEndTime = () => {
        const date = (this.state.endDate || this.state.timeData.values[this.state.timeData.values.length - 1]);
        return date ? date.hour(23).minute(59).second(59) : 0;
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
    scheduleUpdateMapMarkers = () => {
        clearTimeout(this.updateMapMarkersTimeout);
        this.updateMapMarkersTimeout = setTimeout(this.updateMapMarkers, 500);
    }
    updateMapMarkers = () => {
        if (!this.state.visible || !this.state.markersEnabled) {
            return;
        }
        const xmin = this.props.map.bbox.bounds[0];
        const ymin = this.props.map.bbox.bounds[1];
        const xmax = this.props.map.bbox.bounds[2];
        const ymax = this.props.map.bbox.bounds[3];
        const filterGeom = VectorLayerUtils.geoJSONGeomToWkt({
            type: 'Polygon',
            coordinates: [[
                [xmin, ymin],
                [xmax, ymin],
                [xmax, ymax],
                [xmin, ymax],
                [xmin, ymin]
            ]]
        });
        let pending = 0;
        const reqUUID = uuid.v1();
        this.props.layers.forEach(layer => {
            if (layer.uuid in this.state.timeData.attributes) {
                const sublayerattrs = this.state.timeData.attributes[layer.uuid];
                const queryLayers = Object.keys(sublayerattrs).join(",");
                const options = {
                    LAYERATTRIBS: JSON.stringify(sublayerattrs),
                    GEOMCENTROID: true,
                    with_htmlcontent: false
                };
                const request = IdentifyUtils.buildFilterRequest(layer, queryLayers, filterGeom, this.props.map, options);
                axios.get(request.url, {params: request.params}).then((response) => {
                    const features = IdentifyUtils.parseXmlResponse(response.data, this.props.map.projection);
                    if (this.state.timeMarkers && this.state.timeMarkers.reqUUID === reqUUID) {
                        this.setState({timeMarkers: {
                            ...this.state.timeMarkers,
                            markers: [
                                ...this.state.timeMarkers.markers,
                                ...Object.values(features).reduce((res, cur) => [...res, ...cur.map(feature => {
                                    const startdate = dateParser.fromString(feature.properties[sublayerattrs[feature.layername][0]]);
                                    const enddate = dateParser.fromString(feature.properties[sublayerattrs[feature.layername][1]]);
                                    return {
                                        ...feature,
                                        id: feature.layername + "::" + feature.id,
                                        properties: {
                                            ...feature.properties,
                                            startdate: dayjs.utc(startdate),
                                            enddate: dayjs.utc(enddate)
                                        }
                                    };
                                })], [])],
                            pending: this.state.timeMarkers.pending - 1
                        }});
                    }
                }).catch(() => {
                    if (this.state.timeMarkers && this.state.timeMarkers.reqUUID === reqUUID) {
                        this.setState({timeMarkers: {
                            ...this.state.timeMarkers,
                            pending: this.state.timeMarkers.pending - 1
                        }});
                    }
                });
                ++pending;
            }
        });
        this.setState({
            timeMarkers: {markers: [], pending: pending, reqUUID: reqUUID}
        });
    }
    markerStyle = (feature) => {
        const style = [
            new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: 1,
                    src: markerIcon
                })
            })
        ];
        const startDate = feature.getProperties().startdate;
        const endDate = feature.getProperties().enddate;
        const overlapRanges = [];
        this.state.timeData.ranges.forEach((range, idx) => {
            // Check if ranges overlap
            if (startDate <= range[1] && endDate >= range[0]) {
                overlapRanges.push(idx);
            }
        });
        const rectSize = 16;
        let offsetX = -0.5 * (overlapRanges.length - 1) * rectSize;
        overlapRanges.forEach(rangeIdx => {
            style.push(new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({color: this.blockColors[rangeIdx]}),
                    stroke: new ol.style.Stroke({color: 'black', width: 1}),
                    points: 4,
                    radius: 0.5 * rectSize * Math.sqrt(2),
                    angle: Math.PI / 4,
                    displacement: [offsetX, -0.5 * rectSize]
                })
            }));
            offsetX += rectSize;
        });
        return style;
    }
}

const layerVisiblitiesSelector = createSelector([
    state => state.layers.flat
], (layers) => {
    return layers.reduce((res, layer) => ({
        ...res,
        [layer.uuid]: LayerUtils.computeLayerVisibility(layer)
    }), {});
});

const selector = createSelector([state => state, layerVisiblitiesSelector], (state, layerVisibilities) => {
    return {
        active: state.task.id === "TimeManager",
        layers: state.layers.flat,
        layerVisibilities: layerVisibilities,
        map: state.map
    };
});

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setLayerDimensions: setLayerDimensions,
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TimeManager);

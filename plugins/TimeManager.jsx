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
import isEmpty from 'lodash.isempty';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import uuid from 'uuid';
import isEqual from 'lodash.isequal';
import ol from 'openlayers';
import dateParser from 'any-date-parser';
import {setLayerDimensions, addLayerFeatures, removeLayer, LayerRole} from '../actions/layers';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import Icon from '../components/Icon';
import ContinuousTimeline from '../components/ContinuousTimeline';
import Timeline from '../components/Timeline';
import ButtonBar from '../components/widgets/ButtonBar';
import NumberInput from '../components/widgets/NumberInput';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ResizeableWindow from '../components/ResizeableWindow';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/TimeManager.css';
import markerIcon from '../utils/img/marker-icon.png';

dayjs.extend(utc);

const DateUnitLabels = {
    "ms": LocaleUtils.trmsg("timemanager.unit.milliseconds"),
    "s": LocaleUtils.trmsg("timemanager.unit.seconds"),
    "m": LocaleUtils.trmsg("timemanager.unit.minutes"),
    "h": LocaleUtils.trmsg("timemanager.unit.hours"),
    "d": LocaleUtils.trmsg("timemanager.unit.days"),
    "M": LocaleUtils.trmsg("timemanager.unit.months"),
    "y": LocaleUtils.trmsg("timemanager.unit.years"),
    "10y": LocaleUtils.trmsg("timemanager.unit.decade"),
    "100y": LocaleUtils.trmsg("timemanager.unit.century")
};

class TimeManager extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerFeatures: PropTypes.func,
        blockColors: PropTypes.arrayOf(PropTypes.string),
        defaultAnimationInterval: PropTypes.number,
        defaultStepSize: PropTypes.number,
        defaultStepUnit: PropTypes.string,
        drawMarkerOffset: PropTypes.array,
        drawMarkerPins: PropTypes.bool,
        layerVisibilities: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        markersAvailable: PropTypes.bool,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setLayerDimensions: PropTypes.func,
        stepUnits: PropTypes.arrayOf(PropTypes.string)
    }
    static defaultProps = {
        blockColors: [
            "#f7af7d", "#eacc6e", "#fef89a", "#c5e09b", "#a3d29c", "#7cc096", "#79c8c5", "#34afce"
        ],
        defaultAnimationInterval: 1,
        defaultStepSize: 1,
        defaultStepUnit: "d",
        drawMarkerOffset: [0, 0],
        drawMarkerPins: true,
        markersAvailable: true,
        stepUnits: ["s", "m", "h", "d", "M", "y"]
    }
    static defaultState = {
        timeEnabled: false,
        startDate: null,
        endDate: null,
        ranges: [],
        currentTimestamp: 0,
        currentTimestampDrag: null, // Only when dragging
        animationActive: false,
        animationLoop: false,
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
            attributes: {}
        },
        timeline: 'fixed',
        dialogWidth: 0
    }
    constructor(props) {
        super(props);
        this.animationTimer = null;
        this.updateMapMarkersTimeout = null;
        TimeManager.defaultState.stepSize = props.defaultStepSize;
        TimeManager.defaultState.stepSizeUnit = props.defaultStepUnit;
        if (!props.stepUnits.includes(TimeManager.defaultState.stepSizeUnit)) {
            TimeManager.defaultState.stepSizeUnit = props.stepUnits[0];
        }
        TimeManager.defaultState.animationInterval = props.defaultAnimationInterval;
        this.state = {
            ...this.state,
            ...TimeManager.defaultState
        };
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
                attributes: {}
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
            this.setState({timeData: timeData});
            this.updateLayerTimeDimensions(timeData.layerDimensions, this.state.currentTimestamp);
            this.scheduleUpdateMapMarkers();
        }
        if (this.state.currentTimestamp !== prevState.currentTimestamp || this.state.timeEnabled !== prevState.timeEnabled) {
            this.updateLayerTimeDimensions(this.state.timeData.layerDimensions, this.state.currentTimestamp);
        }
        if (this.state.animationActive && this.state.animationInterval !== prevState.animationInterval) {
            this.stopAnimation();
        }
        if (
            this.props.map.bbox !== prevProps.map.bbox ||
            (this.state.visible && !prevState.visible) ||
            this.state.currentTimestamp !== prevState.currentTimestamp ||
            this.state.timeEnabled !== prevState.timeEnabled ||
            this.state.ranges !== prevState.ranges ||
            (this.state.markersEnabled && !prevState.markersEnabled)
        ) {
            this.scheduleUpdateMapMarkers();
        }
        if (!this.state.markersEnabled && prevState.markersEnabled) {
            this.props.removeLayer("timemarkers");
        }
        if (this.state.markersEnabled && this.state.timeMarkers && this.state.timeMarkers !== prevState.timeMarkers && this.state.timeMarkers.pending === 0) {
            const layer = {
                id: "timemarkers",
                role: LayerRole.MARKER,
                styleFunction: this.markerStyle,
                rev: +new Date()
            };
            this.props.addLayerFeatures(layer, this.state.timeMarkers.markers, true);
        }
        if (this.state.timeData !== prevState.timeData || this.state.startDate !== prevState.startDate || this.state.endDate !== prevState.endDate) {
            const startTime = this.getStartTime();
            const endTime = this.getEndTime();
            let ranges = [];
            if (endTime - startTime > 0) {
                const interval = endTime.diff(startTime, 'second');
                const blockInterval = interval / (this.props.blockColors.length - 1);
                ranges = this.props.blockColors.slice(0, -1).map((entry, idx) => {
                    return [
                        startTime.add(idx * blockInterval, 'second'),
                        startTime.add((idx + 1) * blockInterval, 'second')
                    ];
                });
            }
            this.setState({ranges: ranges});
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
            <ResizeableWindow dockable="bottom"  icon="time" initialHeight={240}
                initialWidth={800} onClose={this.onClose} onGeometryChanged={this.dialogGeomChanged}
                scrollable title={LocaleUtils.tr("timemanager.title")}>
                {body}
            </ResizeableWindow>
        );
    }
    renderBody = () => {
        const timeButtons = [
            {key: "rewind", tooltip: LocaleUtils.trmsg("timemanager.rewind"), icon: "nav-start"},
            {key: "prev", tooltip: LocaleUtils.trmsg("timemanager.stepback"), icon: "nav-left"},
            {key: "playrev", tooltip: LocaleUtils.trmsg("timemanager.playrev"), icon: "triangle-left", disabled: this.state.animationActive},
            {key: "stop", tooltip: LocaleUtils.trmsg("timemanager.stop"), icon: "square", disabled: !this.state.animationActive},
            {key: "play", tooltip: LocaleUtils.trmsg("timemanager.play"), icon: "triangle-right", disabled: this.state.animationActive},
            {key: "next", tooltip: LocaleUtils.trmsg("timemanager.stepfwd"), icon: "nav-right"},
            {key: "loop", tooltip: LocaleUtils.trmsg("timemanager.loop"), icon: "refresh", pressed: this.state.animationLoop}
        ];
        const options = (
            <div className="time-manager-options">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("timemanager.stepsize")}:</td>
                            <td>
                                <NumberInput max={100} min={1} onChange={value => this.setState({stepSize: value})} value={this.state.stepSize} />
                            </td>
                            <td>
                                <select onChange={ev => this.setState({stepSizeUnit: ev.target.value})} value={this.state.stepSizeUnit}>
                                    {this.props.stepUnits.map(unit => (
                                        <option key={unit} value={unit}>{LocaleUtils.tr(DateUnitLabels[unit])}</option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("timemanager.animationinterval")}:</td>
                            <td>
                                <NumberInput max={10} min={1} onChange={value => this.setState({animationInterval: value})} value={this.state.animationInterval} />
                            </td>
                            <td>
                                &nbsp;{LocaleUtils.tr("timemanager.unit.seconds")}
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("timemanager.timeline")}</td>
                            <td>
                                <select onChange={ev => this.setState({timeline: ev.target.value})} value={this.state.timeline}>
                                    <option value="fixed">{LocaleUtils.tr("timemanager.timeline_fixed")}</option>
                                    <option value="continuous">{LocaleUtils.tr("timemanager.timeline_continuous")}</option>
                                </select>
                            </td>
                            <td />
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
                    {this.props.markersAvailable ? (
                        <span className="time-manager-toolbar-block">
                            <span>{LocaleUtils.tr("timemanager.markers")}</span>
                            <ToggleSwitch active={this.state.markersEnabled} onChange={value => this.setState({markersEnabled: value})} />
                        </span>
                    ) : null}
                    <span className="time-manager-toolbar-spacer" />
                    <span className="time-manager-options-menubutton">
                        <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState({settingsPopup: !this.state.settingsPopup})}>
                            <Icon icon="cog" />
                        </button>
                        {this.state.settingsPopup ? options : null}
                    </span>
                </div>
                {this.state.timeline === "fixed" ? (
                    <Timeline currentTimestamp={this.state.currentTimestamp} enabled={this.state.timeEnabled}
                        endTime={this.getEndTime()} endTimeChanged={this.setEndTime}
                        gradientSteps={this.state.markersEnabled ? this.props.blockColors : []}
                        startTime={this.getStartTime()} startTimeChanged={this.setStartTime}
                        stepSizeUnit={this.state.stepSizeUnit} timestampChanged={timestamp => this.setState({currentTimestamp: timestamp})}/>
                ) : (
                    <ContinuousTimeline currentTimestamp={this.state.currentTimestamp}
                        dialogWidth={this.state.dialogWidth} enabled={this.state.timeEnabled}
                        endTime={this.getEndTime()} startTime={this.getStartTime()}
                        stepSizeUnit={this.state.stepSizeUnit}
                        timestampChanged={timestamp => this.setState({currentTimestamp: timestamp})}/>
                )}
            </div>
        );
    }
    dialogGeomChanged = (geom) => {
        this.setState({dialogWidth: geom.width});
    }
    toggleTimeEnabled = (enabled) => {
        clearInterval(this.animationTimer);
        clearTimeout(this.updateMapMarkersTimeout);
        this.animationTimer = null;
        this.updateMapMarkersTimeout = null;
        this.setState({timeEnabled: enabled, currentTimestamp: +this.getStartTime(), animationActive: false, timeMarkers: null});
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
            const curday = dayjs(this.state.currentTimestamp);
            const lastday = this.getEndTime();
            if (curday >= lastday) {
                this.setState({currentTimestamp: +this.getStartTime()});
            }
            this.animationTimer = setInterval(() => {
                this.advanceAnimation(+1);
            }, 1000 * this.state.animationInterval);
            this.setState({animationActive: true});
        } else if (action === "playrev") {
            const curday = dayjs(this.state.currentTimestamp);
            const firstday = this.getStartTime();
            if (curday <= firstday) {
                this.setState({currentTimestamp: +this.getEndTime()});
            }
            this.animationTimer = setInterval(() => {
                this.advanceAnimation(-1);
            }, 1000 * this.state.animationInterval);
            this.setState({animationActive: true});
        } else if (action === "loop") {
            this.setState({animationLoop: !this.state.animationLoop});
        }
    }
    advanceAnimation = (stepdir) => {
        const newday = this.step(stepdir);
        const firstday = this.getStartTime();
        const lastday = this.getEndTime();
        if (newday > lastday) {
            if (stepdir > 0 && this.state.animationLoop) {
                this.setState({currentTimestamp: +this.getStartTime()});
            } else {
                this.setState({currentTimestamp: +lastday, animationActive: false});
                clearInterval(this.animationTimer);
                this.animationTimer = null;
            }
        } else if (newday < firstday) {
            if (stepdir < 0 && this.state.animationLoop) {
                this.setState({currentTimestamp: +this.getEndTime()});
            } else {
                this.setState({currentTimestamp: +firstday, animationActive: false});
                clearInterval(this.animationTimer);
                this.animationTimer = null;
            }
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
        const num = parseInt(this.state.stepSizeUnit.slice(0, -1), 10) || 1;
        const newday = day.add(direction * this.state.stepSize * num, this.state.stepSizeUnit.slice(-1));
        if (this.state.stepSizeUnit.endsWith("m")) {
            return newday.second(0);
        } else if (this.state.stepSizeUnit.endsWith("h")) {
            return newday.second(0).minute(0);
        } else if (this.state.stepSizeUnit.endsWith("d")) {
            return newday.second(0).minute(0).hour(0);
        } else if (this.state.stepSizeUnit.endsWith("M")) {
            return newday.second(0).minute(0).hour(0).date(1);
        } else if (this.state.stepSizeUnit.endsWith("y")) {
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
    setStartTime = (value) => {
        const date = (value ? dayjs.utc(value) : this.state.timeData.values[0]).hour(0).minute(0).second(0);
        if (date < this.getEndTime()) {
            this.setState({startDate: date});
        }
        if (dayjs(this.state.currentTimestamp) < date) {
            this.setState({currentTimestamp: +date});
        }
    }
    setEndTime = (value) => {
        const date = (value ? dayjs.utc(value) : this.state.timeData.values[this.state.timeData.values.length - 1]).hour(23).minute(59).second(59);
        if (date > this.getStartTime()) {
            this.setState({endDate: date});
            if (dayjs(this.state.currentTimestamp) > date) {
                this.setState({currentTimestamp: +date});
            }
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
            if (layer.uuid in this.state.timeData.attributes && layer.visibility) {
                const sublayerattrs = this.state.timeData.attributes[layer.uuid];
                const queryLayers = Object.keys(sublayerattrs).join(",");
                const options = {
                    LAYERATTRIBS: JSON.stringify(sublayerattrs),
                    GEOMCENTROID: true,
                    with_htmlcontent: false
                };
                const request = IdentifyUtils.buildFilterRequest(layer, queryLayers, filterGeom, this.props.map, options);
                IdentifyUtils.sendRequest(request, (response) => {
                    if (this.state.timeMarkers && this.state.timeMarkers.reqUUID === reqUUID) {
                        if (response) {
                            const features = IdentifyUtils.parseXmlResponse(response, this.props.map.projection);
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
                    } else {
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
        ];
        if (this.props.drawMarkerPins) {
            style.push(new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: 1,
                    displacement: this.props.drawMarkerOffset,
                    src: markerIcon
                })
            }));
        }
        const startDate = Math.max(this.getStartTime(), feature.getProperties().startdate);
        const endDate = Math.min(this.getEndTime(), feature.getProperties().enddate);
        const gradientStops = [];
        this.state.ranges.forEach((range, idx) => {
            // Check if ranges overlap
            if (startDate <= range[1] && endDate >= range[0]) {
                let kStart = (range[0] - startDate) / (endDate - startDate);
                let cStart = this.props.blockColors[idx];
                if (kStart < 0) {
                    cStart = MiscUtils.blendColors(this.props.blockColors[idx], this.props.blockColors[idx + 1], 1 + kStart);
                    kStart = 0;
                }
                let kEnd = (range[1] - startDate) / (endDate - startDate);
                let cEnd = this.props.blockColors[idx + 1];
                if (kEnd > 1) {
                    cEnd = MiscUtils.blendColors(this.props.blockColors[idx], this.props.blockColors[idx + 1], 1 - (kEnd - 1));
                    kEnd = 1;
                }
                gradientStops.push([kStart, cStart]);
                gradientStops.push([kEnd, cEnd]);
            }
        });
        if (isEmpty(gradientStops)) {
            return null;
        }
        const rectSize = 16;
        const blockSize = this.state.ranges[0][1] - this.state.ranges[0][0];
        const width = (endDate - startDate) / blockSize * rectSize;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(-width, 0, width, 0);
        gradientStops.forEach(stop => {
            gradient.addColorStop(stop[0], stop[1]);
        });

        style.push(new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: gradient}),
                stroke: new ol.style.Stroke({color: 'black', width: 1}),
                points: 4,
                radius: width / Math.SQRT2,
                radius2: width,
                angle: 0,
                scale: [1, rectSize / width],
                displacement: [this.props.drawMarkerOffset[0], this.props.drawMarkerOffset[1] / rectSize * width - width]
            })
        }));
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

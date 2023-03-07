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
import {createSelector} from 'reselect';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import uuid from 'uuid';
import ol from 'openlayers';
import isEqual from 'lodash.isequal';
import dateParser from 'any-date-parser';
import {setLayerDimensions, addLayerFeatures, refreshLayer, removeLayer, LayerRole} from '../actions/layers';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import Icon from '../components/Icon';
import TimelineFeaturesSlider from '../components/timeline/TimelineFeaturesSlider';
import FixedTimeline from '../components/timeline/FixedTimeline';
import InfiniteTimeline from '../components/timeline/InfiniteTimeline';
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
        cursorFormat: PropTypes.string,
        dateFormat: PropTypes.string,
        defaultAnimationInterval: PropTypes.number,
        defaultStepSize: PropTypes.number,
        defaultStepUnit: PropTypes.string,
        defaultTimelineDisplay: PropTypes.string,
        defaultTimelineMode: PropTypes.string,
        layerVisibilities: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        markerConfiguration: PropTypes.shape({
            markersAvailable: PropTypes.bool,
            gradient: PropTypes.arrayOf(PropTypes.string),
            markerOffset: PropTypes.array,
            markerPins: PropTypes.bool
        }),
        refreshLayer: PropTypes.func,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setLayerDimensions: PropTypes.func,
        stepUnits: PropTypes.arrayOf(PropTypes.string)
    }
    static defaultProps = {
        cursorFormat: "datetime",
        dateFormat: "YYYY-MM-DD[\n]HH:mm:ss",
        defaultAnimationInterval: 1,
        defaultStepSize: 1,
        defaultStepUnit: "d",
        defaultTimelineMode: "fixed",
        markerConfiguration: {
            markersAvailable: true,
            gradient: ["#f7af7d", "#eacc6e", "#fef89a", "#c5e09b", "#a3d29c", "#7cc096", "#79c8c5", "#34afce"],
            markerOffset: [0, 0],
            markerPins: true
        },
        featureTimelineAvailable: true,
        stepUnits: ["s", "m", "h", "d", "M", "y"]
    }
    static defaultState = {
        timeEnabled: false,
        startTime: null,
        endTime: null,
        currentTimestamp: null,
        animationActive: false,
        animationLoop: false,
        animationInterval: 1,
        stepSize: 1,
        stepSizeUnit: 'd', // 1 day
        dialogWidth: 0,
        markersEnabled: false,
        markersCanBeEnabled: true,
        timelineDisplay: true,
        timelineMode: 'continuous',
        timeData: {
            layerDimensions: {},
            values: [],
            attributes: {}
        },
        timeFeatures: null,
        settingsPopup: false,
        visible: false
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
        TimeManager.defaultState.timelineMode = props.defaultTimelineMode;
        TimeManager.defaultState.timelineDisplay = props.defaultTimelineDisplay;
        this.state = {
            ...this.state,
            ...TimeManager.defaultState
        };
    }
    componentDidUpdate(prevProps, prevState) {
        const activated = !prevProps.active && this.props.active;
        if (activated) {
            this.setState({visible: true});
            // Clear task immediately after showing, visibility is controlled by internal state
            this.props.setCurrentTask(null);
        }
        if (!this.state.visible && prevState.visible) {
            this.setState(TimeManager.defaultState);
            return;
        }
        if (!activated && !this.state.visible) {
            return;
        }
        if (activated || !isEqual(this.props.layerVisibilities, prevProps.layerVisibilities)) {
            this.stopAnimation();
            const timeData = {
                layerDimensions: {},
                values: new Set(),
                attributes: {},
                layers: []
            };
            this.props.layers.forEach(layer => {
                if (layer.type === "wms") {
                    const layertimeData = LayerUtils.getTimeDimensionValues(layer);
                    if (layertimeData.names.size > 0) {
                        timeData.layerDimensions[layer.uuid] = [...layertimeData.names];
                        layertimeData.values.forEach(x => timeData.values.add(x));
                        timeData.attributes[layer.uuid] = {
                            ...timeData.attributes[layer.uuid],
                            ...layertimeData.attributes
                        };
                        // Filter time dimension from layer - object cache in updateTimeFeatures below should query all objects regardless of time
                        const layerNoTimeDims = {...layer};
                        const layerDimsUC = timeData.layerDimensions[layer.uuid].map(name => name.toUpperCase());
                        layerNoTimeDims.dimensionValues = Object.entries(layerNoTimeDims.dimensionValues || {}).reduce((res, [key, value]) => {
                            if (layerDimsUC.includes(key)) {
                                return res;
                            } else {
                                return {...res, [key]: value};
                            }
                        }, {});
                        timeData.layers.push(layerNoTimeDims);
                    }
                }
            });
            timeData.values = [...timeData.values].sort().map(d => dayjs.utc(d));
            this.setState({
                timeData: timeData,
                currentTimestamp: this.state.currentTimestamp ?? +timeData.values[0],
                startTime: timeData.values.length > 0 ? timeData.values[0].hour(0).minute(0).second(0) : null,
                endTime: timeData.values.length > 0 ? timeData.values[timeData.values.length - 1].hour(23).minute(59).second(59) : null
            });
            this.updateLayerTimeDimensions(timeData, this.state.currentTimestamp);
            this.updateTimeFeatures(timeData);
        } else {
            if (this.state.currentTimestamp !== prevState.currentTimestamp || this.state.timeEnabled !== prevState.timeEnabled) {
                this.updateLayerTimeDimensions(this.state.timeData, this.state.currentTimestamp);
            }
            if (this.state.visible && this.props.map.bbox !== prevProps.map.bbox) {
                this.updateTimeFeatures(this.state.timeData);
            }
        }

        if (this.state.animationActive && this.state.animationInterval !== prevState.animationInterval) {
            this.stopAnimation();
        }

        if (!this.state.markersEnabled && prevState.markersEnabled) {
            this.props.removeLayer("timemarkers");
        } else if (this.state.markersEnabled && this.state.timeFeatures) {
            if (
                this.state.markersEnabled !== prevState.markersEnabled ||
                this.state.timeFeatures !== prevState.timeFeatures
            ) {
                const layer = {
                    id: "timemarkers",
                    role: LayerRole.MARKER,
                    styleFunction: this.markerStyle,
                    rev: +new Date()
                };
                const features = Object.values(this.state.timeFeatures.features).flat();
                this.props.addLayerFeatures(layer, features, true);
            } else if (
                this.state.currentTimestamp !== prevState.currentTimestamp ||
                this.state.timeEnabled !== prevState.timeEnabled
            ) {
                this.props.refreshLayer(layer => layer.id === "timemarkers");
            }
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
            <ResizeableWindow dockable="bottom"  icon="time" initialHeight={320}
                initialWidth={900} onClose={this.onClose} onGeometryChanged={this.dialogGeomChanged}
                scrollable title={LocaleUtils.tr("timemanager.title")}>
                {body}
            </ResizeableWindow>
        );
    }
    renderBody = () => {
        const timeButtons = [
            {key: "rewind", tooltip: LocaleUtils.trmsg("timemanager.rewind"), icon: "nav-start"},
            {key: "now", tooltip: LocaleUtils.trmsg("timemanager.now"), icon: "today"},
            {key: "prev", tooltip: LocaleUtils.trmsg("timemanager.stepback"), icon: "nav-left"},
            {key: "playrev", tooltip: LocaleUtils.trmsg("timemanager.playrev"), icon: "triangle-left", disabled: this.state.animationActive},
            {key: "stop", tooltip: LocaleUtils.trmsg("timemanager.stop"), icon: "square", disabled: !this.state.animationActive},
            {key: "play", tooltip: LocaleUtils.trmsg("timemanager.play"), icon: "triangle-right", disabled: this.state.animationActive},
            {key: "next", tooltip: LocaleUtils.trmsg("timemanager.stepfwd"), icon: "nav-right"},
            {key: "loop", tooltip: LocaleUtils.trmsg("timemanager.loop"), icon: "refresh", pressed: this.state.animationLoop}
        ];
        const markerConfiguration = {
            ...TimeManager.defaultProps.markerConfiguration,
            ...this.props.markerConfiguration
        };
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
                            <td>{LocaleUtils.tr("timemanager.timeline")}:</td>
                            <td colSpan="2">
                                <select onChange={ev => this.setState({timelineMode: ev.target.value})} value={this.state.timelineMode}>
                                    <option value="fixed">{LocaleUtils.tr("timemanager.timeline_fixed")}</option>
                                    <option value="infinite">{LocaleUtils.tr("timemanager.timeline_infinite")}</option>
                                </select>
                            </td>
                        </tr>
                        {this.state.timelineDisplay !== "hidden" ? (
                            <tr>
                                <td>{LocaleUtils.tr("timemanager.timelinedisplay")}:</td>
                                <td colSpan="2">
                                    <select onChange={ev => this.setState({timelineDisplay: ev.target.value})} value={this.state.timelineDisplay}>
                                        <option value="minimal">{LocaleUtils.tr("timemanager.displayminimal")}</option>
                                        <option value="features">{LocaleUtils.tr("timemanager.displayfeatures")}</option>
                                        <option value="layers">{LocaleUtils.tr("timemanager.displaylayers")}</option>
                                    </select>
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        );

        const timeSpan = this.state.endTime.diff(this.state.startTime);
        const Timeline = this.state.timelineMode === 'infinite' ? InfiniteTimeline : FixedTimeline;

        return (
            <div className="time-manager-body" role="body">
                <div className="time-manager-toolbar">
                    <div className="time-manager-toolbar-controls">
                        <span className="time-manager-toolbar-block">
                            <span>{LocaleUtils.tr("timemanager.toggle")}</span>
                            <ToggleSwitch active={this.state.timeEnabled} onChange={this.toggleTimeEnabled} />
                        </span>
                        <ButtonBar buttons={timeButtons} disabled={!this.state.timeEnabled} onClick={this.animationButtonClicked} />
                        {this.props.markerConfiguration.markersAvailable ? (
                            <span className="time-manager-toolbar-block">
                                <span>{LocaleUtils.tr("timemanager.markers")}: &nbsp;</span>
                                <ToggleSwitch active={this.state.markersEnabled} onChange={value => this.setState({markersEnabled: value})} readOnly={!this.state.markersCanBeEnabled} />
                            </span>
                        ) : null}
                    </div>
                    <div className="time-manager-options-menubutton">
                        <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState({settingsPopup: !this.state.settingsPopup})}>
                            <Icon icon="cog" />
                        </button>
                        {this.state.settingsPopup ? options : null}
                    </div>
                </div>
                <div className="time-manager-timeline">
                    <Timeline currentTimestamp={this.state.currentTimestamp}
                        dataEndTime={dayjs(this.state.timeData.values[this.state.timeData.values.length - 1]).hour(23).minute(59).second(59)}
                        dataStartTime={dayjs(this.state.timeData.values[0]).hour(0).minute(0).second(0)}
                        dateFormat={this.props.dateFormat}
                        dialogWidth={this.state.dialogWidth}
                        endTime={this.state.endTime}
                        setEndTime={this.setEndTime}
                        setMarkersCanBeEnabled={value => this.setState({markersCanBeEnabled: value, markersEnabled: false})}
                        setStartTime={this.setStartTime}
                        startTime={this.state.startTime}
                        timeSpan={timeSpan}
                    >
                        {
                            (computePixelFromTime, computeTimeFromPixel) => (
                                <TimelineFeaturesSlider
                                    computePixelFromTime={computePixelFromTime}
                                    computeTimeFromPixel={computeTimeFromPixel}
                                    currentTimestamp={this.state.currentTimestamp}
                                    cursorFormat={this.props.cursorFormat}
                                    dateFormat={this.props.dateFormat}
                                    displayMode={this.state.timelineDisplay}
                                    endTime={this.state.endTime}
                                    markerConfiguration={markerConfiguration}
                                    markersEnabled={this.state.markersEnabled}
                                    startTime={this.state.startTime}
                                    stepSizeUnit={this.state.stepSizeUnit}
                                    timeEnabled={this.state.timeEnabled}
                                    timeFeatures={this.state.timeFeatures}
                                    timestampChanged={(timestamp) => this.setState({currentTimestamp: timestamp})}
                                />
                            )
                        }
                    </Timeline>
                </div>
            </div>
        );
    }
    dialogGeomChanged = (geom) => {
        this.setState({dialogWidth: geom.docked ? document.body.offsetWidth : geom.width});
    }
    toggleTimeEnabled = (enabled) => {
        clearInterval(this.animationTimer);
        clearTimeout(this.updateMapMarkersTimeout);
        this.animationTimer = null;
        this.updateMapMarkersTimeout = null;
        this.setState({timeEnabled: enabled, currentTimestamp: +this.state.startTime, animationActive: false, timeMarkers: null});
    }
    animationButtonClicked = (action) => {
        this.stopAnimation();
        if (action === "rewind") {
            this.setState({currentTimestamp: +this.state.startTime, animationActive: false});
        } else if (action === "now") {
            this.setState({currentTimestamp: +dayjs(), animationActive: false});
        } else if (action === "prev") {
            const newday = this.step(-1);
            this.setState({currentTimestamp: +Math.max(newday, this.state.startTime)});
        } else if (action === "next") {
            const newday = this.step(+1);
            this.setState({currentTimestamp: +Math.min(newday, this.state.endTime)});
        } else if (action === "stop") {
            /* Already stopped above, pass */
        } else if (action === "play") {
            const curday = dayjs(this.state.currentTimestamp);
            const lastday = this.state.endTime;
            if (curday >= lastday) {
                this.setState({currentTimestamp: +this.state.startTime});
            }
            this.animationTimer = setInterval(() => {
                this.advanceAnimation(+1);
            }, 1000 * this.state.animationInterval);
            this.setState({animationActive: true});
        } else if (action === "playrev") {
            const curday = dayjs(this.state.currentTimestamp);
            const firstday = this.state.startTime;
            if (curday <= firstday) {
                this.setState({currentTimestamp: +this.state.endTime});
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
        const firstday = this.state.startTime;
        const lastday = this.state.endTime;
        if (newday > lastday) {
            if (stepdir > 0 && this.state.animationLoop) {
                this.setState({currentTimestamp: +this.state.startTime});
            } else {
                this.setState({currentTimestamp: +lastday, animationActive: false});
                clearInterval(this.animationTimer);
                this.animationTimer = null;
            }
        } else if (newday < firstday) {
            if (stepdir < 0 && this.state.animationLoop) {
                this.setState({currentTimestamp: +this.state.endTime});
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
    updateLayerTimeDimensions = (timeData, currentTimestamp) => {
        const currentTime = this.state.timeEnabled ? new Date(currentTimestamp).toISOString() : undefined;
        timeData.layers.forEach(layer => {
            const dimensions = timeData.layerDimensions[layer.uuid].reduce((res, dimension) => {
                res[dimension.toUpperCase()] = currentTime;
                return res;
            }, {...(layer.dimensionValues || {})});
            this.props.setLayerDimensions(layer.id, dimensions);
        });
    }
    setStartTime = (value) => {
        const date = (value ? dayjs.utc(value) : this.state.timeData.values[0]).hour(0).minute(0).second(0);
        if (date < this.state.endTime) {
            this.setState({startTime: date});
        }
        if (dayjs(this.state.currentTimestamp) < date) {
            this.setState({currentTimestamp: +date});
        }
    }
    setEndTime = (value) => {
        const date = (value ? dayjs.utc(value) : this.state.timeData.values[this.state.timeData.values.length - 1]).hour(23).minute(59).second(59);
        if (date > this.state.startTime) {
            this.setState({endTime: date});
            if (dayjs(this.state.currentTimestamp) > date) {
                this.setState({currentTimestamp: +date});
            }
        }
    }
    updateTimeFeatures = (timeData) => {
        // Query all features in extent
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
        timeData.layers.forEach(layer => {
            const sublayerattrs = timeData.attributes[layer.uuid];
            const queryLayers = Object.keys(sublayerattrs).join(",");
            const options = {
                GEOMCENTROID: true,
                with_htmlcontent: false
            };
            const request = IdentifyUtils.buildFilterRequest(layer, queryLayers, filterGeom, this.props.map, options);
            IdentifyUtils.sendRequest(request, (response) => {
                if (this.state.timeFeatures && this.state.timeFeatures.reqUUID === reqUUID && response) {
                    const layerFeatures = IdentifyUtils.parseXmlResponse(response, this.props.map.projection);
                    this.setState({timeFeatures: {
                        features: {
                            ...this.state.timeFeatures.features,
                            ...Object.entries(layerFeatures).reduce((res, [layername, features]) => {
                                return {...res, [layername]: features.map(feature => {
                                    const startdate = dateParser.fromString(feature.properties[sublayerattrs[feature.layername][0]]);
                                    const enddate = dateParser.fromString(feature.properties[sublayerattrs[feature.layername][1]]);
                                    return {
                                        ...feature,
                                        id: feature.layername + "::" + feature.id,
                                        properties: {
                                            ...feature.properties,
                                            __startdate: dayjs.utc(startdate),
                                            __enddate: dayjs.utc(enddate)
                                        }
                                    };
                                })};
                            }, {})
                        },
                        attributes: {
                            ...this.state.timeFeatures.attributes,
                            ...Object.entries(layerFeatures).reduce((res, [layername, features]) => {
                                return {...res, [layername]: Object.keys((features[0] || {properties: {}}).properties)};
                            }, {})
                        },
                        pendingRequests: this.state.timeFeatures.pendingRequests - 1
                    }});
                } else {
                    this.setState({timeFeatures: {
                        ...this.state.timeFeatures,
                        pendingRequests: this.state.timeFeatures.pendingRequests - 1
                    }});
                }
            });
            ++pending;
        });
        this.setState({
            timeFeatures: {features: {}, attributes: {}, pendingRequests: pending, reqUUID: reqUUID}
        });
    }
    markerStyle = (feature) => {
        const style = [
        ];
        const currentTime = dayjs(this.state.currentTimestamp);
        const featprops = feature.getProperties();
        if (this.state.timeEnabled && (featprops.__startdate > currentTime || featprops.__enddate < currentTime)) {
            return style;
        }
        const offset = this.props.markerConfiguration.markerOffset;
        if (this.props.markerConfiguration.markerPins) {
            style.push(new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    displacement: offset,
                    src: markerIcon
                })
            }));
        }
        if (featprops.__startdate.isValid() && featprops.__enddate.isValid()) {
            const deltaT = this.state.endTime.diff(this.state.startTime);
            const markerStartTime = dayjs(Math.max(this.state.startTime, featprops.__startdate));
            const markerEndTime = dayjs(Math.min(this.state.endTime, featprops.__enddate));
            const markerMidTime = 0.5 * (markerStartTime + markerEndTime);
            const gradBarMaxWidth = 192;
            const gradBarHeight = 16;
            const gradBarWidth = gradBarMaxWidth * markerEndTime.diff(markerStartTime) / deltaT;

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const gradient = context.createLinearGradient(
                -gradBarWidth * (markerMidTime - this.state.startTime) / (markerMidTime - markerStartTime), 0,
                gradBarWidth * (this.state.endTime - markerMidTime) / (markerEndTime - markerMidTime), 0
            );
            const nStops = this.props.markerConfiguration.gradient.length;

            this.props.markerConfiguration.gradient.forEach((stop, idx) => {
                gradient.addColorStop(idx / (nStops - 1), stop);
            });

            style.push(new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({color: gradient}),
                    stroke: new ol.style.Stroke({color: 'black', width: 1}),
                    points: 4,
                    radius: gradBarWidth / Math.SQRT2,
                    radius2: gradBarWidth,
                    angle: 0,
                    scale: [1, 1 / gradBarWidth * gradBarHeight],
                    displacement: [offset[0], offset[1] * gradBarHeight / gradBarWidth - gradBarHeight]
                })
            }));
        }
        return style;
    }
}

const layerVisiblitiesSelector = createSelector([
    state => state.layers.flat
], (layers) => {
    return layers.filter(layer => layer.type === "wms").reduce((res, layer) => ({
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
    refreshLayer: refreshLayer,
    removeLayer: removeLayer,
    setLayerDimensions: setLayerDimensions,
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TimeManager);

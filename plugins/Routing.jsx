/**
 * Copyright 2023 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {createSelector} from 'reselect';
import FileSaver from 'file-saver';
import NumericInput from 'react-numeric-input2';
import Sortable from 'react-sortablejs';
import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {zoomToExtent} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import ButtonBar from '../components/widgets/ButtonBar';
import SearchWidget from '../components/widgets/SearchWidget';
import Spinner from '../components/Spinner';
import ResizeableWindow from '../components/ResizeableWindow';
import displayCrsSelector from '../selectors/displaycrs';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MeasureUtils from '../utils/MeasureUtils';
import RoutingInterface from '../utils/RoutingInterface';
import './style/Routing.css';


class Routing extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        displaycrs: PropTypes.string,
        enabledProviders: PropTypes.array,
        locatePos: PropTypes.array,
        mapcrs: PropTypes.string,
        removeLayer: PropTypes.func,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        task: PropTypes.object,
        windowSize: PropTypes.object,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        enabledProviders: ["coordinates", "nominatim"],
        windowSize: {width: 320, height: 320}
    };
    state = {
        visible: false,
        currentTab: 'Route',
        mode: 'auto',
        settings: {
            auto: {
                method: 'fastest',
                maxSpeed: 130
            },
            bus: {
                method: 'fastest',
                maxSpeed: 100
            },
            bicycle: {
                method: 'fastest',
                maxSpeed: 25
            },
            pedestrian: {
                method: 'fastest',
                maxSpeed: 4
            }
        },
        settingsPopup: false,
        routeConfig: {
            routepoints: [
                {text: '', pos: null, crs: null},
                {text: '', pos: null, crs: null}
            ],
            result: null,
            roundtrip: false
        },
        isoConfig: {
            point: {text: '', pos: null, crs: null},
            mode: 'time',
            intervals: '5, 10',
            result: null
        },
        searchProviders: [],
        searchParams: {}
    };
    constructor(props) {
        super(props);
        this.recomputeTimeout = null;
        this.state.searchProviders = props.enabledProviders.map(key => props.searchProviders[key]);
        this.state.searchParams = {
            mapcrs: this.props.mapcrs,
            displaycrs: this.props.displaycrs,
            lang: LocaleUtils.lang()
        };
    }
    componentDidUpdate(prevProps, prevState) {
        // Activated / message
        if (this.props.task.id === "Routing") {
            this.props.setCurrentTask(null);
            if (!this.state.visible) {
                this.setState({visible: true});
            }
            const taskData = (this.props.task.data || {});
            if (taskData.from) {
                this.setState({currentTab: 'Route'});
                this.updateRoutePoint(0, taskData.from);
            }
            if (taskData.to) {
                this.setState({currentTab: 'Route'});
                this.updateRoutePoint(this.state.routeConfig.routepoints.length - 1, taskData.to);
            }
            if (taskData.via) {
                this.setState({currentTab: 'Route'});
                this.addRoutePt(taskData.via);
            }
            if (taskData.isocenter) {
                this.setState({currentTab: 'Reachability'});
                this.updateIsoConfig({point: taskData.isocenter});
            }
        }
        // Tab changed
        if (this.state.currentTab !== prevState.currentTab) {
            this.props.removeLayer("routingggeometries");
            this.props.removeLayer("routingmarkers");
            this.recomputeIfNeeded();
        }
        // Mode changed
        if (this.state.mode !== prevState.mode) {
            this.recomputeIfNeeded();
        }
        // Window closed
        if (!this.state.visible && prevState.visible) {
            this.props.removeLayer("routingggeometries");
            this.props.removeLayer("routingmarkers");
            this.updateRouteConfig({routepoints: [{text: '', pos: null, crs: null}, {text: '', pos: null, crs: null}]});
            this.updateIsoConfig({point: {text: '', pos: null, crs: null}});
        }
        // Routing markers
        if (
            this.state.currentTab !== prevState.currentTab ||
            this.state.routeConfig.routepoints !== prevState.routeConfig.routepoints ||
            this.state.isoConfig.point !== prevState.isoConfig.point
        ) {
            this.updateRoutingMarkers();
        }
    }
    render() {
        if (!this.state.visible) {
            return null;
        }
        const tabButtons = [
            {key: "Route", label: LocaleUtils.tr("routing.route")},
            {key: "Reachability", label: LocaleUtils.tr("routing.reachability")}
        ];
        const tabRenderers = {
            Route: this.renderRouteWidget,
            Reachability: this.renderIsochroneWidget
        };
        const buttons = [
            {key: "auto", icon: "routing-car", tooltip: "routing.mode_auto"},
            {key: "bus", icon: "routing-bus", tooltip: "routing.mode_bus"},
            {key: "bicycle", icon: "routing-bicycle", tooltip: "routing.mode_bicycle"},
            {key: "pedestrian", icon: "routing-walking", tooltip: "routing.mode_walking"}
        ];
        return (
            <ResizeableWindow icon="routing" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.tr("routing.windowtitle")} >
                <div role="body">
                    <ButtonBar active={this.state.currentTab} buttons={tabButtons} onClick={(key) => this.setState({currentTab: key})} />
                    <div className="routing-frame">
                        <div className="routing-buttons">
                            <ButtonBar active={this.state.mode} buttons={buttons} onClick={key => this.setState({mode: key})} />
                            <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState((state) => ({settingsPopup: !state.settingsPopup}))}>
                                <Icon icon="cog" />
                            </button>
                            {this.state.settingsPopup ? this.renderSettings() : null}
                        </div>
                        {tabRenderers[this.state.currentTab]()}
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    renderSettings = () => {
        return (
            <div className="routing-settings-menu">
                <table className="routing-settings-menu-entries">
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("routing.method")}:</td>
                            <td>
                                <select onChange={(ev) => this.updateSetting(this.state.mode, {method: ev.target.value})} value={this.state.settings[this.state.mode].method}>
                                    <option value="fastest">{LocaleUtils.tr("routing.fastest")}</option>
                                    <option value="shortest">{LocaleUtils.tr("routing.shortest")}</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("routing.maxspeed")}:</td>
                            <td>
                                <NumericInput
                                    format={x => x + " km/h"} max={250} min={1} mobile
                                    onChange={(value) => this.updateSetting(this.state.mode, {maxSpeed: value})}
                                    precision={0} step={1} strict value={this.state.settings[this.state.mode].maxSpeed} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };
    renderRouteWidget = () => {
        const routeConfig = this.state.routeConfig;
        return (
            <div>
                <div className="routing-routepoints">
                    <Sortable onChange={this.onSortChange} options={{ghostClass: 'drop-ghost', delay: 200}}>
                        {routeConfig.routepoints.map((entry, idx) => this.renderSearchField(entry, idx))}
                    </Sortable>
                    <div>
                        <Icon icon="up-down-arrow" onClick={this.reverseRoutePts} />
                    </div>
                </div>
                <div className="routing-routepoints-commands">
                    <label><input onChange={(ev) => this.updateRouteConfig({roundtrip: ev.target.checked})} type="checkbox" value={routeConfig.roundtrip} /> {LocaleUtils.tr("routing.roundtrip")}</label>
                </div>
                <div className="routing-routepoints-commands">
                    <a href="#" onClick={() => this.addRoutePt()}><Icon icon="plus" /> {LocaleUtils.tr("routing.add")}</a>
                    <span />
                    <a href="#" onClick={this.clearRoutePts}><Icon icon="clear" /> {LocaleUtils.tr("routing.clear")}</a>
                </div>
                {routeConfig.busy ? (
                    <div className="routing-busy"><Spinner /> {LocaleUtils.tr("routing.computing")}</div>
                ) : null}
                {routeConfig.result ? this.renderRouteResult(routeConfig) : null}
            </div>
        );
    };
    renderRouteResult = (routeConfig) => {
        if (routeConfig.result.success === false) {
            return (
                <div className="routing-status-failure">
                    {routeConfig.result.data.errorMsgId ? LocaleUtils.tr(routeConfig.result.data.errorMsgId) : routeConfig.result.data.error}
                </div>
            );
        } else {
            return (
                <div className="routing-result-summary">
                    <div>
                        <span><Icon icon="clock" /> {MeasureUtils.formatDuration(routeConfig.result.data.summary.time)}</span>
                        <span className="routing-result-spacer" />
                        <span><Icon icon="measure" /> {MeasureUtils.formatMeasurement(routeConfig.result.data.summary.length, false)}</span>
                        <span className="routing-result-spacer" />
                        <span><Icon icon="export" /> <a href="#" onClick={this.exportRoute}>{LocaleUtils.tr("routing.export")}</a></span>
                    </div>
                </div>
            );
        }
    };
    renderIsochroneWidget = () => {
        const isoConfig = this.state.isoConfig;
        const intervalValid = !!isoConfig.intervals.match(/^\d+(,\s*\d+)*$/);
        return (
            <div className="routing-frame">
                <div>
                    <InputContainer className="routing-search-field">
                        <SearchWidget resultSelected={(result) => this.isoSearchResultSelected(result)} role="input" searchParams={this.state.searchParams} searchProviders={this.state.searchProviders} value={isoConfig.point.text} />
                        <button className="button" disabled={!this.props.locatePos} onClick={() => this.updateRoutePoint(0, this.locatePos())} role="suffix">
                            <Icon icon="screenshot" />
                        </button>
                    </InputContainer>
                </div>
                <table className="routing-iso-settings">
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("routing.iso_mode")}: </td>
                            <td colSpan="2">
                                <select onChange={ev =>this.updateIsoConfig({mode: ev.target.value})} value={isoConfig.mode}>
                                    <option value="time">{LocaleUtils.tr("routing.iso_mode_time")}</option>
                                    <option value="distance">{LocaleUtils.tr("routing.iso_mode_distance")}</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("routing.iso_intervals")}: </td>
                            <td>
                                <input className={isoConfig.intervals && !intervalValid ? "routing-input-invalid" : ""} onChange={(ev) => this.updateIsoConfig({intervals: ev.target.value})} placeholder="5, 10, 15" type="text" value={isoConfig.intervals} />
                            </td>
                            <td>{isoConfig.mode === "time" ? "min" : "km"}</td>
                        </tr>
                    </tbody>
                </table>
                {isoConfig.busy ? (
                    <div className="routing-busy"><Spinner /> {LocaleUtils.tr("routing.computing")}</div>
                ) : null}
                {isoConfig.result ? this.renderIsochroneResult(isoConfig) : null}
            </div>
        );
    };
    renderIsochroneResult = (isoConfig) => {
        if (isoConfig.result.success === false) {
            return (
                <div className="routing-status-failure">
                    {isoConfig.result.data.errorMsgId ? LocaleUtils.tr(isoConfig.result.data.errorMsgId) : isoConfig.result.data.error}
                </div>
            );
        } else {
            return (
                <div className="routing-result-summary">
                    <div><Icon icon="export" /> <a href="#" onClick={this.exportIsochrone}>{LocaleUtils.tr("routing.export")}</a></div>
                </div>
            );
        }
    };
    renderSearchField = (entry, idx) => {
        const numpoints = this.state.routeConfig.routepoints.length;
        return (
            <InputContainer className="routing-search-field" key={"field" + idx}>
                <SearchWidget resultSelected={(result) => this.routeSearchResultSelected(idx, result)} role="input" searchParams={this.state.searchParams} searchProviders={this.state.searchProviders} value={entry.text} />
                {idx === 0 ? (
                    <button className="button" disabled={!this.props.locatePos} onClick={() => this.updateRoutePoint(0, this.locatePos())} role="suffix">
                        <Icon icon="screenshot" />
                    </button>
                ) : null}
                {idx > 0 && idx < numpoints - 1 ? (
                    <button className="button" onClick={() => this.removeRoutePt(idx)} role="suffix">
                        <Icon icon="remove" />
                    </button>
                ) : null}
            </InputContainer>
        );
    };
    locatePos = () => {
        return {
            pos: [...this.props.locatePos],
            text: this.props.locatePos.map(x => x.toFixed(4)).join(", "),
            crs: 'EPSG:4326'
        };
    };
    updateSetting = (mode, diff) => {
        this.setState((state) => ({settings: {
            ...state.settings,
            [mode]: {
                ...state.settings[mode],
                ...diff
            }
        }}));
        this.recomputeIfNeeded();
    };
    addRoutePt = (entry = {text: '', pos: null}) => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            routepoints: [
                ...state.routeConfig.routepoints.slice(0, -1),
                entry,
                ...state.routeConfig.routepoints.slice(-1)
            ]
        }}));
        this.recomputeIfNeeded();
    };
    removeRoutePt = (idx) => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            routepoints: [
                ...state.routeConfig.routepoints.slice(0, idx),
                ...state.routeConfig.routepoints.slice(idx + 1)
            ]
        }}));
        this.recomputeIfNeeded();
    };
    clearRoutePts = () => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            routepoints: [
                {text: '', pos: null, crs: null},
                {text: '', pos: null, crs: null}
            ]
        }}));
        this.recomputeIfNeeded();
    };
    reverseRoutePts = () => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            routepoints: state.routeConfig.routepoints.reverse()
        }}));
        this.recomputeIfNeeded();
    };
    updateRouteConfig = (diff, recompute = true) => {
        this.setState((state) => ({routeConfig: {...state.routeConfig, ...diff}}));
        if (recompute) {
            this.recomputeIfNeeded();
        }
    };
    updateRoutePoint = (idx, diff) => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            routepoints: [
                ...state.routeConfig.routepoints.slice(0, idx),
                {...state.routeConfig.routepoints[idx], ...diff},
                ...state.routeConfig.routepoints.slice(idx + 1)
            ]
        }}));
        this.recomputeIfNeeded();
    };
    updateIsoConfig = (diff, recompute = true) => {
        this.setState((state) => ({isoConfig: {...state.isoConfig, ...diff}}));
        if (recompute) {
            this.recomputeIfNeeded();
        }
    };
    onClose = () => {
        this.setState({visible: false});
    };
    isoSearchResultSelected = (result) => {
        if (result) {
            this.updateIsoConfig({point: {text: result.text, pos: [result.x, result.y], crs: result.crs}});
        } else {
            this.updateIsoConfig({point: {text: "", pos: null, crs: null}});
        }
    };
    routeSearchResultSelected = (idx, result) => {
        if (result) {
            this.updateRoutePoint(idx, {text: result.text, pos: [result.x, result.y], crs: result.crs});
        } else {
            this.updateRoutePoint(idx, {text: "", pos: null, crs: null});
        }
    };
    updateRoutingMarkers = () => {
        let points = [];
        if (this.state.currentTab === "Route") {
            points = this.state.routeConfig.routepoints;
        } else {
            points = [this.state.isoConfig.point];
        }
        const layer = {
            id: "routingmarkers",
            role: LayerRole.MARKER,
            styleName: 'marker'
        };
        const features = points.filter(point => point.pos).map(point => ({
            type: "Feature",
            crs: point.crs,
            geometry: {
                type: "Point",
                coordinates: point.pos
            }
        }));
        this.props.addLayerFeatures(layer, features, true);
    };
    computeRoute = () => {
        const locations = this.state.routeConfig.routepoints.filter(entry => entry.pos).map(entry => {
            return CoordinatesUtils.reproject(entry.pos, entry.crs, "EPSG:4326");
        });
        this.props.removeLayer("routingggeometries");
        this.updateRouteConfig({busy: locations.length >= 2, result: null}, false);
        if (locations.length < 2) {
            return;
        }
        if (this.state.routeConfig.roundtrip) {
            locations.push(locations[0]);
        }
        RoutingInterface.computeRoute(this.state.mode, locations, this.state.settings[this.state.mode], (success, result) => {
            if (success) {
                const layer = {
                    id: "routingggeometries",
                    role: LayerRole.SELECTION,
                    styleOptions: {
                        strokeColor: [10, 10, 255, 1],
                        strokeWidth: 4,
                        strokeDash: []
                    }
                };
                const features = result.legs.map(leg => ({
                    type: "Feature",
                    crs: "EPSG:4326",
                    geometry: {
                        type: "LineString",
                        coordinates: leg.coordinates
                    }
                }));
                this.props.addLayerFeatures(layer, features, true);
                this.props.zoomToExtent(result.summary.bounds, "EPSG:4326", -1);
            }
            this.updateRouteConfig({result: {success, data: result}, busy: false}, false);
        });
    };
    computeIsochrone = () => {
        const intervalValid = !!this.state.isoConfig.intervals.match(/^\d+(,\s*\d+)*$/);
        if (!intervalValid) {
            return;
        }
        const location = CoordinatesUtils.reproject(this.state.isoConfig.point.pos, this.state.isoConfig.point.crs, "EPSG:4326");
        this.props.removeLayer("routingggeometries");
        this.updateIsoConfig({busy: true, result: null}, false);
        const contourOptions = {
            mode: this.state.isoConfig.mode,
            intervals: this.state.isoConfig.intervals.split(",").map(entry => parseInt(entry.trim(), 10)).sort()
        };
        RoutingInterface.computeIsochrone(this.state.mode, location, contourOptions, this.state.settings[this.state.mode], (success, result) => {
            if (success) {
                const layer = {
                    id: "routingggeometries",
                    role: LayerRole.SELECTION,
                    styleOptions: {
                        strokeColor: [10, 10, 255, 1],
                        fillColor: [10, 10, 255, 0.5],
                        strokeWidth: 4,
                        strokeDash: []
                    }
                };
                const features = result.areas.map(area => ({
                    type: "Feature",
                    crs: "EPSG:4326",
                    geometry: {
                        type: "Polygon",
                        coordinates: [area]
                    }
                }));
                this.props.addLayerFeatures(layer, features, true);
                this.props.zoomToExtent(result.bounds, "EPSG:4326", -1);
            }
            this.updateIsoConfig({result: {success, data: result}, busy: false}, false);
        });
    };
    recomputeIfNeeded = () => {
        clearTimeout(this.recomputeTimeout);
        this.recomputeTimeout = setTimeout(() => {
            if (this.state.currentTab === "Route" && this.state.routeConfig.routepoints.filter(entry => entry.pos).length >= 2) {
                this.computeRoute();
            } else if (this.state.currentTab === "Reachability" && this.state.isoConfig.point.pos) {
                this.computeIsochrone();
            }
            this.recomputeTimeout = null;
        }, 750);
    };
    exportRoute = () => {
        const data = JSON.stringify({
            type: "FeatureCollection",
            features: this.state.routeConfig.result.data.legs.map(leg => ({
                type: "Feature",
                properties: {
                    time: leg.time,
                    length: leg.length
                },
                geometry: {
                    type: "LineString",
                    coordinates: leg.coordinates
                }
            }))
        });
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "route.json");
    };
    exportIsochrone = () => {
        const data = JSON.stringify({
            type: "FeatureCollection",
            features: this.state.isoConfig.result.data.areas.map(area => ({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [area]
                }
            }))
        });
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "isochrone.json");
    };
    onSortChange = (order, sortable, ev) => {
        const newRoutePoints = this.state.routeConfig.routepoints.slice(0);
        const moved = newRoutePoints.splice(ev.oldIndex, 1)[0];
        newRoutePoints.splice(ev.newIndex, 0, moved);
        this.updateRouteConfig({routepoints: newRoutePoints});
    };
}

export default (searchProviders) => {
    const providers = {...searchProviders, ...window.QWC2SearchProviders || {}};
    return connect(createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
        task: state.task,
        mapcrs: state.map.projection,
        searchProviders: providers,
        displaycrs: displaycrs,
        locatePos: state.locate.position
    })), {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        setCurrentTask: setCurrentTask,
        zoomToExtent: zoomToExtent
    })(Routing);
};

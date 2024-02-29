/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import NumericInput from 'react-numeric-input2';
import {connect} from 'react-redux';
import Sortable from 'react-sortablejs';

import FileSaver from 'file-saver';
import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {zoomToExtent} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import ResizeableWindow from '../components/ResizeableWindow';
import Spinner from '../components/Spinner';
import ButtonBar from '../components/widgets/ButtonBar';
import DateTimeInput from '../components/widgets/DateTimeInput';
import SearchWidget from '../components/widgets/SearchWidget';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker';
import displayCrsSelector from '../selectors/displaycrs';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MeasureUtils from '../utils/MeasureUtils';
import RoutingInterface from '../utils/RoutingInterface';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/Routing.css';


/**
 * Compute routes and isochrones.
 *
 * Requites `routingServiceUrl` in `config.json` pointing to a Valhalla routing service.
 */
class Routing extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        displaycrs: PropTypes.string,
        /** List of enabled routing modes. */
        enabledModes: PropTypes.arrayOf(PropTypes.string),
        /** List of search providers to use for routing location search. */
        enabledProviders: PropTypes.arrayOf(PropTypes.string),
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        layers: PropTypes.array,
        locatePos: PropTypes.array,
        mapcrs: PropTypes.string,
        removeLayer: PropTypes.func,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        /** Whether to label the routing waypoint pins with the route point number. */
        showPinLabels: PropTypes.bool,
        task: PropTypes.object,
        theme: PropTypes.object,
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        enabledModes: ["auto", "heavyvehicle", "transit", "bicycle", "pedestrian"],
        enabledProviders: ["coordinates", "nominatim"],
        geometry: {
            initialWidth: 320,
            initialHeight: 640,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true,
            side: 'left'
        },
        showPinLabels: true
    };
    state = {
        visible: false,
        currentTab: 'Route',
        mode: 'auto',
        settings: {
            auto: {
                method: 'fastest',
                maxSpeed: 130,
                useFerries: true,
                useHighways: true,
                useTollways: true
            },
            heavyvehicle: {
                method: 'fastest',
                maxSpeed: 100,
                useFerries: true,
                useHighways: true,
                useTollways: true
            },
            transit: {
                timepoint: 'now',
                time: ''
            },
            bicycle: {
                method: 'fastest',
                maxSpeed: 25,
                useFerries: true
            },
            pedestrian: {
                method: 'fastest',
                maxSpeed: 4,
                useFerries: true
            }
        },
        settingsPopup: false,
        routeConfig: {
            points: [
                {text: '', pos: null, crs: null},
                {text: '', pos: null, crs: null}
            ],
            result: null,
            roundtrip: false,
            optimized_route: false,
            excludeLayer: null
        },
        isoConfig: {
            points: [
                {text: '', pos: null, crs: null}
            ],
            mode: 'time',
            intervals: '5, 10',
            result: null
        },
        searchProviders: [],
        searchParams: {},
        highlightId: null
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
        this.state.mode = this.props.enabledModes[0];
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
                this.updatePoint('routeConfig', 0, taskData.from);
            }
            if (taskData.to) {
                this.setState({currentTab: 'Route'});
                this.updatePoint('routeConfig', this.state.routeConfig.points.length - 1, taskData.to);
            }
            if (taskData.via) {
                this.setState({currentTab: 'Route'});
                this.addPoint('routeConfig', -1, taskData.via);
            }
            if (taskData.isocenter) {
                this.setState({currentTab: 'Reachability'});
                this.updateIsoConfig({points: [taskData.isocenter]});
            }
            if (taskData.isoextracenter) {
                this.setState({currentTab: 'Reachability'});
                this.updateIsoConfig({points: [...this.state.isoConfig.points, taskData.isoextracenter]});
            }
        }
        // Window closed
        if (!this.state.visible && prevState.visible) {
            this.props.removeLayer("routinggeometries");
            this.props.removeLayer("routingmarkers");
            this.updateRouteConfig({points: [{text: '', pos: null, crs: null}, {text: '', pos: null, crs: null}], result: null}, false);
            this.updateIsoConfig({point: {text: '', pos: null, crs: null}, result: null}, false);
        }
        // No further processing beyond here if not visible
        if (!this.state.visible) {
            return;
        }
        // Tab changed
        if (this.state.currentTab !== prevState.currentTab) {
            this.props.removeLayer("routinggeometries");
            this.props.removeLayer("routingmarkers");
            this.recomputeIfNeeded();
        }
        // Mode changed
        if (this.state.mode !== prevState.mode) {
            this.recomputeIfNeeded();
        }
        // Routing markers
        if (
            this.state.currentTab !== prevState.currentTab ||
            this.state.routeConfig.points !== prevState.routeConfig.points ||
            this.state.isoConfig.points !== prevState.isoConfig.points
        ) {
            this.updateRoutingMarkers();
        }
        // Theme changed
        if (this.props.theme !== prevProps.theme) {
            this.setState({visible: false});
        }
        // Recompute when exclude layer changes
        if (this.state.currentTab === 'Route' && this.state.routeConfig.excludeLayer && this.props.layers !== prevProps.layers) {
            const newlayer = this.props.layers.find(layer => layer.id === this.state.routeConfig.excludeLayer);
            const prevLayer = prevProps.layers.find(layer => layer.id === this.state.routeConfig.excludeLayer);
            if (newlayer !== prevLayer) {
                this.recomputeIfNeeded();
            }
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
            {key: "auto", icon: "routing-car", tooltip: LocaleUtils.trmsg("routing.mode_auto")},
            {key: "heavyvehicle", icon: "routing-truck", tooltip: LocaleUtils.trmsg("routing.mode_heavyvehicle")},
            {key: "transit", icon: "routing-train", tooltip: LocaleUtils.trmsg("routing.mode_transit")},
            {key: "bicycle", icon: "routing-bicycle", tooltip: LocaleUtils.trmsg("routing.mode_bicycle")},
            {key: "pedestrian", icon: "routing-walking", tooltip: LocaleUtils.trmsg("routing.mode_walking")}
        ];
        const enabledButtons = this.props.enabledModes.map(entry => buttons.find(button => button.key === entry));
        return (
            <ResizeableWindow dockable={this.props.geometry.side} icon="routing"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={() => this.setState({visible: false})} title={LocaleUtils.tr("routing.windowtitle")}
            >
                <div className="routing-body" role="body">
                    <ButtonBar active={this.state.currentTab} buttons={tabButtons} className="routing-buttonbar" onClick={(key) => this.setState({currentTab: key})} />
                    <div className="routing-frame">
                        <div className="routing-buttons">
                            <ButtonBar active={this.state.mode} buttons={enabledButtons} onClick={key => this.setState({mode: key})} />
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
        const settings = this.state.settings[this.state.mode];
        return (
            <div className="routing-settings-menu">
                <table className="routing-settings-menu-entries">
                    <tbody>
                        {settings.method !== undefined ? (
                            <tr>
                                <td>{LocaleUtils.tr("routing.method")}:</td>
                                <td>
                                    <select onChange={(ev) => this.updateSetting(this.state.mode, {method: ev.target.value})} value={settings.method}>
                                        <option value="fastest">{LocaleUtils.tr("routing.fastest")}</option>
                                        <option value="shortest">{LocaleUtils.tr("routing.shortest")}</option>
                                    </select>
                                </td>
                            </tr>
                        ) : null}
                        {settings.maxSpeed !== undefined ? (
                            <tr>
                                <td>{LocaleUtils.tr("routing.maxspeed")}:</td>
                                <td>
                                    <NumericInput
                                        format={x => x + " km/h"} max={250} min={1} mobile
                                        onChange={(value) => this.updateSetting(this.state.mode, {maxSpeed: value})}
                                        precision={0} step={1} strict value={settings.maxSpeed} />
                                </td>
                            </tr>
                        ) : null}
                        {settings.useFerries !== undefined ? (
                            <tr>
                                <td>{LocaleUtils.tr("routing.useferries")}:</td>
                                <td>
                                    <ToggleSwitch active={settings.useFerries} onChange={(value) => this.updateSetting(this.state.mode, {useFerries: value})} />
                                </td>
                            </tr>
                        ) : null}
                        {settings.useHighways !== undefined ? (
                            <tr>
                                <td>{LocaleUtils.tr("routing.usehighways")}:</td>
                                <td>
                                    <ToggleSwitch active={settings.useHighways} onChange={(value) => this.updateSetting(this.state.mode, {useHighways: value})} />
                                </td>
                            </tr>
                        ) : null}
                        {settings.useTollways !== undefined ? (
                            <tr>
                                <td>{LocaleUtils.tr("routing.usetollways")}:</td>
                                <td>
                                    <ToggleSwitch active={settings.useTollways} onChange={(value) => this.updateSetting(this.state.mode, {useTollways: value})} />
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        );
    };
    renderRouteWidget = () => {
        const routeConfig = this.state.routeConfig;
        const vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
        const numpoints = routeConfig.points.length;
        return (
            <div className="routing-tab-widget">
                <div className="routing-input">
                    <div className="routing-points">
                        <Sortable onChange={this.onSortChange} options={{ghostClass: 'drop-ghost', delay: 200}}>
                            {routeConfig.points.map((entry, idx) => {
                                let placeholder = LocaleUtils.tr("routing.addviapoint");
                                if (idx === 0) {
                                    placeholder = LocaleUtils.tr("routing.fromhere");
                                } else if (idx === routeConfig.points.length - 1) {
                                    placeholder = LocaleUtils.tr("routing.tohere");
                                }
                                return this.renderSearchField(entry, idx, 'routeConfig', idx > 0 && idx < numpoints - 1, placeholder);
                            })}
                        </Sortable>
                        <div>
                            <Icon icon="up-down-arrow" onClick={this.reverseRoutePts} />
                        </div>
                    </div>
                    <div className="routing-points-commands">
                        <a href="#" onClick={() => this.addPoint('routeConfig', -1)}><Icon icon="plus" /> {LocaleUtils.tr("routing.add")}</a>
                        <span className="routing-points-commands-spacer" />
                        {this.renderImportButton('routeConfig')}
                        <span className="routing-points-commands-spacer" />
                        <a href="#" onClick={() => this.clearConfig('routeConfig')}><Icon icon="clear" /> {LocaleUtils.tr("routing.clear")}</a>
                    </div>
                    {this.state.mode === 'transit' ? (
                        <div className="routing-time-settings">
                            <select onChange={this.updateTransitTimepoint} value={this.state.settings.transit.timepoint}>
                                <option value="now">{LocaleUtils.tr("routing.leavenow")}</option>
                                <option value="leaveat">{LocaleUtils.tr("routing.leaveat")}</option>
                                <option value="arriveat">{LocaleUtils.tr("routing.arriveat")}</option>
                            </select>
                            {this.state.settings.transit.timepoint !== 'now' ? (
                                <DateTimeInput onChange={value => this.updateSetting('transit', {time: value})} value={this.state.settings.transit.time} />
                            ) : null}
                        </div>
                    ) : null}
                    <div className="routing-points-commands">
                        <label><input onChange={(ev) => this.updateRouteConfig({roundtrip: ev.target.checked})} type="checkbox" value={routeConfig.roundtrip} /> {LocaleUtils.tr("routing.roundtrip")}</label>
                    </div>
                    {this.state.mode !== 'transit' ? (
                        <div className="routing-points-commands">
                            <label><input onChange={(ev) => this.updateRouteConfig({optimized_route: ev.target.checked})} type="checkbox" value={routeConfig.optimized_route} /> {LocaleUtils.tr("routing.optimized_route")}</label>
                        </div>
                    ) : null}
                    {ConfigUtils.havePlugin("Redlining") ? (
                        <div className="routing-points-commands">
                            <span>{LocaleUtils.tr("routing.excludepolygons")}:&nbsp;</span>
                            <VectorLayerPicker
                                layers={vectorLayers} onChange={layer => this.updateRouteConfig({excludeLayer: (layer || {}).id})}
                                showNone value={routeConfig.excludeLayer || ""} />
                            <button className="button" onClick={this.setRedliningTool}><Icon icon="draw" /></button>
                        </div>
                    ) : null}
                </div>
                {routeConfig.busy ? (
                    <div className="routing-busy"><Spinner /> {LocaleUtils.tr("routing.computing")}</div>
                ) : null}
                {routeConfig.result ? this.renderRouteResult(routeConfig) : null}
            </div>
        );
    };
    updateTransitTimepoint = (ev) => {
        const diff = {timepoint: ev.target.value};
        if (ev.target.value !== 'now' && this.state.settings.transit.timepoint === 'now') {
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            diff.time = new Date(Date.now() - tzoffset).toISOString().slice(0, -1);
        }
        this.updateSetting('transit', diff);
    };
    setRedliningTool = () => {
        this.props.setCurrentTask("Redlining", null, null, {layerId: this.state.routeConfig.excludeLayer});
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
                <div className="routing-result">
                    <div className="routing-result-summary">
                        <span><Icon icon="clock" /> {MeasureUtils.formatDuration(routeConfig.result.data.summary.time)}</span>
                        <span className="routing-result-spacer" />
                        <span><Icon icon="measure" /> {MeasureUtils.formatMeasurement(routeConfig.result.data.summary.length, false)}</span>
                        <span className="routing-result-spacer" />
                        <span><Icon icon="export" /> <a href="#" onClick={this.exportRoute}>{LocaleUtils.tr("routing.export")}</a></span>
                    </div>
                    <div className="routing-result-instructions">
                        {routeConfig.result.data.legs.map((leg, lidx) => leg.maneuvers.map((entry, eidx) => (
                            <div className="routing-result-instruction"
                                key={"instr" + lidx + ":" + eidx}
                                onMouseEnter={() => this.highlightRouteSection(lidx + ":" + eidx, entry, leg)}
                                onMouseLeave={() => this.clearRouteSectionHighlight(lidx + ":" + eidx)}
                            >
                                <div><Icon icon={entry.icon} /><b>{entry.instruction}</b></div>
                                <div className="routing-result-instruction-summary">
                                    <span><Icon icon="clock" /> {MeasureUtils.formatDuration(entry.time)}</span>
                                    <span className="routing-result-spacer" />
                                    <span><Icon icon="measure" /> {MeasureUtils.formatMeasurement(entry.length, false)}</span>
                                </div>
                            </div>
                        )))}
                    </div>
                </div>
            );
        }
    };
    highlightRouteSection = (id, entry, leg) => {
        this.setState({highlightId: id});
        const feature = {
            type: "Feature",
            crs: "EPSG:4326",
            geometry: {
                type: "LineString",
                coordinates: leg.coordinates.slice(entry.geom_indices[0], entry.geom_indices[1] + 1)
            }
        };
        const sellayer = {
            id: "routingselection",
            role: LayerRole.SELECTION,
            styleOptions: {
                strokeWidth: 3,
                strokeColor: [255, 255, 0, 1],
                strokeDash: []
            }
        };
        this.props.addLayerFeatures(sellayer, [feature], true);
    };
    clearRouteSectionHighlight = (id) => {
        if (this.state.highlightId === id) {
            this.setState({highlightId: null});
            this.props.removeLayer("routingselection");
        }
    };
    renderIsochroneWidget = () => {
        const isoConfig = this.state.isoConfig;
        const intervalValid = !!isoConfig.intervals.match(/^\d+(,\s*\d+)*$/);
        return (
            <div className="routing-tab-widget">
                <div className="routing-input">
                    <div>
                        {isoConfig.points.map((entry, idx) => this.renderSearchField(entry, idx, 'isoConfig', idx > 0))}
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
                    <div className="routing-points-commands">
                        <a href="#" onClick={() => this.addPoint('isoConfig', isoConfig.points.length)}><Icon icon="plus" /> {LocaleUtils.tr("routing.add")}</a>
                        <span className="routing-points-commands-spacer" />
                        {this.renderImportButton('isoConfig')}
                        <span className="routing-points-commands-spacer" />
                        <a href="#" onClick={() => this.clearConfig('isoConfig')}><Icon icon="clear" /> {LocaleUtils.tr("routing.clear")}</a>
                    </div>
                </div>
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
                <div className="routing-result">
                    <div className="routing-result-summary">
                        <Icon icon="export" /> <a href="#" onClick={this.exportIsochrone}>{LocaleUtils.tr("routing.export")}</a>
                    </div>
                </div>
            );
        }
    };
    renderSearchField = (entry, idx, config, removeable, placeholder = null) => {
        return (
            <InputContainer className="routing-search-field" key={"field" + idx}>
                <SearchWidget placeholder={placeholder} resultSelected={(result) => this.searchResultSelected(config, idx, result)} role="input" searchParams={this.state.searchParams} searchProviders={this.state.searchProviders} value={entry.text} />
                {idx === 0 ? (
                    <button className="button" disabled={!this.props.locatePos} onClick={() => this.updatePoint(config, 0, this.locatePos())} role="suffix">
                        <Icon icon="screenshot" />
                    </button>
                ) : null}
                {removeable ? (
                    <button className="button" onClick={() => this.removePoint(config, idx)} role="suffix">
                        <Icon icon="remove" />
                    </button>
                ) : null}
            </InputContainer>
        );
    };
    renderImportButton = (config) => {
        return (
            <label className="routing-import-button" title={LocaleUtils.tr("routing.importhint")}>
                <Icon icon="import" /> {LocaleUtils.tr("routing.importpoints")}
                <input onChange={(ev) => this.importPoints(ev, config)} type="file" />
            </label>
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
    addPoint = (config, index = -1, entry = {text: '', pos: null}) => {
        this.setState((state) => ({[config]: {
            ...state[config],
            points: [
                ...state[config].points.slice(0, index),
                entry,
                ...state[config].points.slice(index)
            ]
        }}));
        if (entry.pos) {
            this.recomputeIfNeeded();
        }
    };
    updatePoint = (config, idx, diff) => {
        this.setState((state) => ({[config]: {
            ...state[config],
            points: [
                ...state[config].points.slice(0, idx),
                {...state[config].points[idx], ...diff},
                ...state[config].points.slice(idx + 1)
            ]
        }}));
        this.recomputeIfNeeded();
    };
    importPoints = (ev, config) => {
        const reader = new FileReader();
        reader.onload = (loadev) => {
            try {
                const obj = JSON.parse(loadev.target.result);
                let crs = "EPSG:4326";
                if (obj.crs && obj.crs.properties) {
                    crs = CoordinatesUtils.fromOgcUrnCrs(obj.crs.properties.name);
                }
                const prec = CoordinatesUtils.getUnits(crs) === 'degrees' ? 4 : 0;
                this.setState((state) => ({[config]: {
                    ...state[config],
                    points: obj.features.map(feature => {
                        const coordinates = feature.geometry.coordinates;
                        return {
                            text: coordinates.map(x => x.toFixed(prec)).join(", ") + " (" + crs + ")",
                            pos: coordinates,
                            crs: crs
                        };
                    })
                }}));
                this.recomputeIfNeeded();
            } catch (e) {
                // eslint-disable-next-line
                alert(LocaleUtils.tr("routing.importerror"));
            }
        };
        reader.readAsText(ev.target.files[0]);
    };
    removePoint = (config, idx) => {
        this.setState((state) => ({[config]: {
            ...state[config],
            points: [
                ...state[config].points.slice(0, idx),
                ...state[config].points.slice(idx + 1)
            ]
        }}));
        this.recomputeIfNeeded();
    };
    clearConfig = (config) => {
        const newPoints = config === 'routeConfig' ? [
            {text: '', pos: null, crs: null},
            {text: '', pos: null, crs: null}
        ] : [
            {text: '', pos: null, crs: null}
        ];
        this.setState((state) => ({[config]: {
            ...state[config],
            points: newPoints,
            result: null
        }}));
        this.props.removeLayer("routinggeometries");
        this.props.removeLayer("routingmarkers");
        this.recomputeIfNeeded();
    };
    reverseRoutePts = () => {
        this.setState((state) => ({routeConfig: {
            ...state.routeConfig,
            points: state.routeConfig.points.reverse()
        }}));
        this.recomputeIfNeeded();
    };
    updateRouteConfig = (diff, recompute = true) => {
        this.setState((state) => ({routeConfig: {...state.routeConfig, ...diff}}));
        if (recompute) {
            this.recomputeIfNeeded();
        }
    };
    updateIsoConfig = (diff, recompute = true) => {
        this.setState((state) => ({isoConfig: {...state.isoConfig, ...diff}}));
        if (recompute) {
            this.recomputeIfNeeded();
        }
    };
    searchResultSelected = (config, idx, result) => {
        if (result) {
            this.updatePoint(config, idx, {text: result.text, pos: [result.x, result.y], crs: result.crs});
        } else {
            this.updatePoint(config, idx, {text: "", pos: null, crs: null});
        }
    };
    updateRoutingMarkers = () => {
        let points = [];
        if (this.state.currentTab === "Route") {
            points = this.state.routeConfig.points;
        } else {
            points = this.state.isoConfig.points;
        }
        const layer = {
            id: "routingmarkers",
            role: LayerRole.MARKER,
            styleName: 'marker'
        };
        const features = points.filter(point => point.pos).map((point, idx) => ({
            type: "Feature",
            crs: point.crs,
            geometry: {
                type: "Point",
                coordinates: point.pos
            },
            properties: {
                label: this.props.showPinLabels && this.state.routeConfig.result ? String(idx + 1) : null
            }
        }));
        this.props.addLayerFeatures(layer, features, true);
    };
    computeRoute = () => {
        const locations = this.state.routeConfig.points.filter(entry => entry.pos).map(entry => {
            return CoordinatesUtils.reproject(entry.pos, entry.crs, "EPSG:4326");
        });
        this.props.removeLayer("routinggeometries");
        this.updateRouteConfig({busy: locations.length >= 2, result: null}, false);
        if (locations.length < 2) {
            return;
        }
        if (this.state.routeConfig.roundtrip) {
            locations.push(locations[0]);
        }
        const settings = {
            ...this.state.settings[this.state.mode]
        };
        if (this.state.routeConfig.excludeLayer) {
            const layer = this.props.layers.find(l => l.id === this.state.routeConfig.excludeLayer);
            if (layer) {
                settings.exclude_polygons = layer.features.filter(feature => {
                    return feature.geometry.type === "Polygon";
                }).map(feature => {
                    return VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.mapcrs, "EPSG:4326").coordinates[0];
                });
            }
        }
        settings.optimized_route = this.state.routeConfig.optimized_route;
        RoutingInterface.computeRoute(this.state.mode, locations, settings, (success, result) => {
            if (success) {
                // Add routing leg geometries
                const layer = {
                    id: "routinggeometries",
                    role: LayerRole.SELECTION,
                    styleName: "default",
                    styleOptions: {
                        strokeColor: [10, 10, 255, 1],
                        strokeWidth: 4,
                        strokeDash: []
                    }
                };
                const features = [];
                result.legs.forEach(leg => {
                    leg.maneuvers.forEach(man => {
                        features.push({
                            type: "Feature",
                            crs: "EPSG:4326",
                            styleOptions: {
                                strokeColor: man.color
                            },
                            geometry: {
                                type: "LineString",
                                coordinates: leg.coordinates.slice(man.geom_indices[0], man.geom_indices[1] + 1)
                            }
                        });
                    });
                });
                this.props.addLayerFeatures(layer, features, true);

                // Reorder locations based on routing result, keeping null entries
                const {points, nullPoints} = this.state.routeConfig.points.reduce((res, point, idx) => {
                    return point.pos ? {...res, points: [...res.points, point]} : {...res, nullPoints: [...res.nullPoints, {point, idx}]};
                }, {points: [], nullPoints: []});
                const reorderedPoints = result.locations.map(location => points[location.orig_idx]).filter(Boolean);
                nullPoints.forEach(entry => {
                    reorderedPoints.splice(entry.idx, 0, entry.point);
                });
                this.updateRouteConfig({points: reorderedPoints, result: {success, data: result}, busy: false}, false);

                this.props.zoomToExtent(result.summary.bounds, "EPSG:4326", -1);
            } else {
                this.updateRouteConfig({result: {success, data: result}, busy: false}, false);
            }
        });
    };
    computeIsochrone = () => {
        const intervalValid = !!this.state.isoConfig.intervals.match(/^\d+(,\s*\d+)*$/);
        if (!intervalValid) {
            return;
        }
        const locations = this.state.isoConfig.points.filter(entry => entry.pos).map(entry => {
            return CoordinatesUtils.reproject(entry.pos, entry.crs, "EPSG:4326");
        });
        this.props.removeLayer("routinggeometries");
        this.updateIsoConfig({busy: true, result: null}, false);
        const contourOptions = {
            mode: this.state.isoConfig.mode,
            intervals: this.state.isoConfig.intervals.split(",").map(entry => parseInt(entry.trim(), 10)).sort()
        };
        RoutingInterface.computeIsochrone(this.state.mode, locations, contourOptions, this.state.settings[this.state.mode], (success, result) => {
            if (success) {
                const layer = {
                    id: "routinggeometries",
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
                this.props.zoomToExtent(result.bounds, "EPSG:4326", -0.5);
            }
            this.updateIsoConfig({result: {success, data: result}, busy: false}, false);
        });
    };
    recomputeIfNeeded = () => {
        clearTimeout(this.recomputeTimeout);
        this.recomputeTimeout = setTimeout(() => {
            if (this.state.currentTab === "Route" && this.state.routeConfig.points.filter(entry => entry.pos).length >= 2) {
                this.computeRoute();
            } else if (this.state.currentTab === "Reachability" && this.state.isoConfig.points.filter(entry => entry.pos).length > 0) {
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
        const newpoints = this.state.routeConfig.points.slice(0);
        const moved = newpoints.splice(ev.oldIndex, 1)[0];
        newpoints.splice(ev.newIndex, 0, moved);
        this.updateRouteConfig({points: newpoints});
    };
}

export default (searchProviders) => {
    const providers = {...searchProviders, ...window.QWC2SearchProviders || {}};
    return connect(createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
        task: state.task,
        theme: state.theme.current,
        mapcrs: state.map.projection,
        searchProviders: providers,
        displaycrs: displaycrs,
        layers: state.layers.flat,
        locatePos: state.locate.position
    })), {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        setCurrentTask: setCurrentTask,
        zoomToExtent: zoomToExtent
    })(Routing);
};

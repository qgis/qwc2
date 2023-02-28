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
import MapUtils from '../utils/MapUtils';
import MeasureUtils from '../utils/MeasureUtils';
import RoutingInterface from '../utils/RoutingInterface';
import './style/Routing.css';


class Routing extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerFeatures: PropTypes.func,
        click: PropTypes.object,
        displaycrs: PropTypes.string,
        enabledProviders: PropTypes.array,
        locatePos: PropTypes.array,
        mapcrs: PropTypes.string,
        removeLayer: PropTypes.func,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        windowSize: PropTypes.object,
        zoomToExtent: PropTypes.func
    }
    static defaultProps = {
        enabledProviders: ["coordinates", "nominatim"],
        windowSize: {width: 320, height: 320}
    }
    state = {
        currentTab: 'Route',
        mode: 'auto',
        settings: {
            auto: {
                maxSpeed: 130
            },
            bus: {
                maxSpeed: 100
            },
            bicycle: {
                maxSpeed: 25
            },
            pedestrian: {
                maxSpeed: 4
            }
        },
        settingsPopup: false,
        routeConfig: {
            routepoints: [
                {text: '', pos: null, crs: null},
                {text: '', pos: null, crs: null}
            ],
            result: null
        },
        isoConfig: {
            point: {text: '', pos: null, crs: null},
            mode: 'time',
            intervals: '',
            result: null
        },
        searchProviders: [],
        searchParams: {},
        popupPos: null
    }
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
        // Window closed
        if (!this.props.active && prevProps.active) {
            this.hidePopup();
            this.props.removeLayer("routingggeometries");
            this.props.removeLayer("routingmarkers");
        }
        // Map popup
        if (this.props.active) {
            const newPoint = this.props.click;
            if (!newPoint) {
                if (this.state.popupPos) {
                    this.hidePopup();
                }
            } else {
                const oldPoint = prevProps.click;
                if (!oldPoint || oldPoint.pixel[0] !== newPoint.pixel[0] || oldPoint.pixel[1] !== newPoint.pixel[1]) {
                    this.setState({popupPos: newPoint.coordinate});
                }
            }
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
        if (!this.props.active) {
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
        return [
            (
                <ResizeableWindow icon="routing" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                    key="RoutingDialog" onClose={this.onClose} title={LocaleUtils.tr("routing.windowtitle")} >
                    <div role="body">
                        <ButtonBar active={this.state.currentTab} buttons={tabButtons} onClick={this.changeCurrentTab} />
                        <div className="routing-frame">
                            <div className="routing-buttons">
                                <ButtonBar active={this.state.mode} buttons={buttons} onClick={key => this.setState({mode: key})} />
                                <button className={"button" + (this.state.settingsPopup ? " pressed" : "")} onClick={() => this.setState({settingsPopup: !this.state.settingsPopup})}>
                                    <Icon icon="cog" />
                                </button>
                                {this.state.settingsPopup ? this.renderSettings() : null}
                            </div>
                            {tabRenderers[this.state.currentTab]()}
                        </div>
                    </div>
                </ResizeableWindow>
            ),
            this.renderMapPopup()
        ];
    }
    renderSettings = () => {
        return (
            <div className="routing-settings-menu">
                <div className="routing-settings-menu-entry">
                    <span>{LocaleUtils.tr("routing.maxspeed")}:</span>
                    <NumericInput
                        format={x => x + " km/h"} max={250} min={1} mobile
                        onChange={(value) => this.updateSetting(this.state.mode, {maxSpeed: value})}
                        precision={0} step={1} strict value={this.state.settings[this.state.mode].maxSpeed} />
                </div>
            </div>
        );
    }
    renderRouteWidget = () => {
        const routeConfig = this.state.routeConfig;
        return (
            <div>
                <div className="routing-routepoints">
                    <div>
                        {routeConfig.routepoints.map((entry, idx) => this.renderSearchField(entry, idx))}
                    </div>
                    <div>
                        <Icon icon="up-down-arrow" onClick={this.reverseRoutePts} />
                    </div>
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
    }
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
    }
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
    }
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
    }
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
    }
    renderMapPopup = () => {
        if (!this.state.popupPos) {
            return null;
        }
        let body = null;
        const prec = CoordinatesUtils.getUnits(this.props.displaycrs) === 'degrees' ? 4 : 0;
        const pos = CoordinatesUtils.reproject(this.state.popupPos, this.props.mapcrs, this.props.displaycrs);
        const point = {
            text: pos.map(x => x.toFixed(prec)).join(", ") + " (" + this.props.displaycrs + ")",
            pos: [...pos],
            crs: this.props.displaycrs
        };
        if (this.state.currentTab === "Route") {
            const lastPoint = this.state.routeConfig.routepoints.length - 1;
            body = (
                <div className="mapinfotooltip-body">
                    <div className="routing-popup-button"><button className="button" onClick={() => {this.updateRoutePoint(0, point); this.hidePopup();}}>{LocaleUtils.tr("routing.fromhere")}</button></div>
                    <div className="routing-popup-button"><button className="button" onClick={() => {this.updateRoutePoint(lastPoint, point); this.hidePopup();}}>{LocaleUtils.tr("routing.tohere")}</button></div>
                    <div className="routing-popup-button"><button className="button" onClick={() => {this.addRoutePt(point); this.hidePopup();}}>{LocaleUtils.tr("routing.addviapoint")}</button></div>
                </div>
            );
        } else if (this.state.currentTab === "Reachability") {
            body = (
                <div className="mapinfotooltip-body">
                    <div className="routing-popup-button"><button className="button" onClick={() => {this.updateIsoConfig({point}); this.hidePopup();}}>{LocaleUtils.tr("routing.setcenter")}</button></div>
                </div>
            );
        } else {
            return null;
        }
        const pixel = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK)(this.state.popupPos);
        const style = {
            left: pixel[0] + "px",
            top: pixel[1] + "px"
        };
        return (
            <div className="mapinfotooltip" key="RoutingPopup" style={style}>
                <div className="mapinfotooltip-window">
                    <div className="mapinfotooltip-titlebar">
                        <span className="mapinfotooltip-title" />
                        <Icon className="mapinfotooltip-button" icon="remove" onClick={() => this.setState({popupPos: null})}/>
                    </div>
                    {body}
                </div>
            </div>
        );
    }
    hidePopup = () => {
        this.setState({popupPos: null});
    }
    changeCurrentTab = (key) => {
        this.props.removeLayer("routingggeometries");
        this.setState({
            currentTab: key,
            routeConfig: {
                ...this.state.routeConfig,
                result: null
            }
        });
    }
    locatePos = () => {
        return {
            pos: [...this.props.locatePos],
            text: this.props.locatePos.map(x => x.toFixed(4)).join(", "),
            crs: 'EPSG:4326'
        };
    }
    updateSetting = (mode, diff) => {
        this.setState({settings: {
            ...this.state.settings,
            [mode]: {
                ...this.state.settings[mode],
                ...diff
            }
        }});
        this.recomputeIfNeeded();
    }
    addRoutePt = (entry = {text: '', pos: null}) => {
        this.setState({routeConfig: {
            ...this.state.routeConfig,
            routepoints: [
                ...this.state.routeConfig.routepoints.slice(0, -1),
                entry,
                ...this.state.routeConfig.routepoints.slice(-1)
            ]
        }});
        this.recomputeIfNeeded();
    }
    removeRoutePt = (idx) => {
        this.setState({routeConfig: {
            ...this.state.routeConfig,
            routepoints: [
                ...this.state.routeConfig.routepoints.slice(0, idx),
                ...this.state.routeConfig.routepoints.slice(idx + 1)
            ]
        }});
        this.recomputeIfNeeded();
    }
    clearRoutePts = () => {
        this.setState({routeConfig: {
            ...this.state.routeConfig,
            routepoints: [
                {text: '', pos: null, crs: null},
                {text: '', pos: null, crs: null}
            ]
        }});
        this.recomputeIfNeeded();
    }
    reverseRoutePts = () => {
        this.setState({routeConfig: {
            ...this.state.routeConfig,
            routepoints: this.state.routeConfig.routepoints.reverse()
        }});
        this.recomputeIfNeeded();
    }
    updateRouteConfig = (diff, recompute = true) => {
        this.setState({routeConfig: {...this.state.routeConfig, ...diff}});
        if (recompute) {
            this.recomputeIfNeeded();
        }
    }
    updateRoutePoint = (idx, diff) => {
        this.setState({routeConfig: {
            ...this.state.routeConfig,
            routepoints: [
                ...this.state.routeConfig.routepoints.slice(0, idx),
                {...this.state.routeConfig.routepoints[idx], ...diff},
                ...this.state.routeConfig.routepoints.slice(idx + 1)
            ]
        }});
        this.recomputeIfNeeded();
    }
    updateIsoConfig = (diff, recompute = true) => {
        this.setState({isoConfig: {...this.state.isoConfig, ...diff}});
        if (recompute) {
            this.recomputeIfNeeded();
        }
    }
    onClose = () => {
        this.props.setCurrentTask(null);
    }
    isoSearchResultSelected = (result) => {
        if (result) {
            this.updateIsoConfig({point: {text: result.text, pos: [result.x, result.y], crs: result.crs}});
        } else {
            this.updateIsoConfig({point: {text: "", pos: null, crs: null}});
        }
    }
    routeSearchResultSelected = (idx, result) => {
        if (result) {
            this.updateRoutePoint(idx, {text: result.text, pos: [result.x, result.y], crs: result.crs});
        } else {
            this.updateRoutePoint(idx, {text: "", pos: null, crs: null});
        }
    }
    updateRoutingMarkers = () => {
        let points = [];
        if (this.state.currentTab === "Route") {
            points = this.state.routeConfig.routepoints
        } else {
            points = [this.state.isoConfig.point];
        }
        const layer = {
            id: "routingmarkers",
            role: LayerRole.MARKER,
            styleName: 'marker',

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
    }
    computeRoute = () => {
        const locations = this.state.routeConfig.routepoints.filter(entry => entry.pos).map(entry => {
            return CoordinatesUtils.reproject(entry.pos, entry.crs, "EPSG:4326");
        });
        this.props.removeLayer("routingggeometries");
        this.updateRouteConfig({busy: locations.length >= 2, result: null}, false);
        if (locations.length < 2) {
            return;
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
    }
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
    }
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
    }
    exportRoute = () => {
        const data = JSON.stringify({
            type: "FeatureCollection",
            features: this.state.routeConfig.result.data.legs.map(leg => ({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: leg.coordinates
                }
            }))
        });
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), "route.json");
    }
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
    }
}

export default (searchProviders) => {
    const providers = {...searchProviders, ...window.QWC2SearchProviders || {}};
    return connect(createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
        active: state.task.id === "Routing",
        mapcrs: state.map.projection,
        click: state.map.click,
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

/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import axios from 'axios';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import {MapContainerPortalContext} from '../components/PluginsContainer';
import CopyButton from '../components/widgets/CopyButton';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {getElevationInterface} from '../utils/ElevationInterface';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/MapInfoTooltip.css';


/**
 * Provides map context information when right-clicking on the map.
 *
 * Displays the coordinates at the picked position by default.
 *
 * If `elevationServiceUrl` in `config.json` to points to a `qwc-elevation-service`,
 * or a custom elevation interface is exposed in `window.QWC2ElevationInterface` (see
 * [ElevationInterface.js](https://github.com/qgis/qwc2/blob/master/utils/ElevationInterface.js)), the
 * height at the picked position is also displayed.
 *
 * If `mapInfoService` in `config.json` points to a `qwc-mapinfo-service`, additional
 * custom information according to the `qwc-mapinfo-service` configuration is returned.
 *
 * You can pass additional plugin components to the `MapInfoTooltip` in `appConfig.js`:
 * ```json
 * MapInfoTooltipPlugin: MapInfoTooltipPlugin([FirstPlugin, SecondPlugin])
 * ```
 * where a Plugin is a React component of the form
 * ```jsx
 * class MapInfoTooltipPlugin extends React.Component {
 *   static propTypes = {
 *     point: PropTypes.object,
 *     closePopup: PropTypes.func
 *   }
 *   render() { return ...; }
 * };
 * ```
 */
class MapInfoTooltip extends React.Component {
    static contextType = MapContainerPortalContext;
    static propTypes = {
        /** The number of decimal places to display for elevation values. */
        elevationPrecision: PropTypes.number,
        enabled: PropTypes.bool,
        includeWGS84: PropTypes.bool,
        map: PropTypes.object,
        /** Additional plugin components for the map info tooltip. */
        plugins: PropTypes.array,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        elevationPrecision: 0,
        includeWGS84: true,
        plugins: []
    };
    state = {
        point: null, elevation: null, extraInfo: null
    };
    componentDidUpdate(prevProps) {
        if (!this.props.enabled && this.state.point) {
            this.clear();
            return;
        }
        const newPoint = this.props.map.click;
        if (!newPoint || newPoint.button !== 2) {
            if (this.state.point) {
                this.clear();
            }
        } else {
            const oldPoint = prevProps.map.click;
            if (!oldPoint || oldPoint.pixel[0] !== newPoint.pixel[0] || oldPoint.pixel[1] !== newPoint.pixel[1]) {
                this.setState({point: newPoint, elevation: null, extraInfo: null});
                const pos = newPoint.coordinate;
                const crs = this.props.map.projection;
                getElevationInterface().getElevation(pos, crs).then(elevation => {
                    this.setState({elevation: elevation});
                }).catch(() => {});
                const mapInfoService = ConfigUtils.getConfigProp("mapInfoService");
                if (mapInfoService) {
                    axios.get(mapInfoService, {params: {pos: pos.join(","), crs}}).then(response => {
                        this.setState({extraInfo: response.data.results});
                    }).catch(() => {});
                }
            }
        }
    }
    clear = () => {
        this.setState({point: null, elevation: null, extraInfo: null});
    };
    render() {
        if (!this.state.point) {
            return null;
        }

        const info = [];

        const projections = [this.props.map.displayCrs];
        if (!projections.includes(this.props.map.projection)) {
            projections.push(this.props.map.projection);
        }
        if (this.props.includeWGS84 && !projections.includes("EPSG:4326")) {
            projections.push("EPSG:4326");
        }
        projections.map(crs => {
            const coo = CoordinatesUtils.reproject(this.state.point.coordinate, this.props.map.projection, crs);
            const decimals = CoordinatesUtils.getPrecision(crs);
            info.push([
                (CoordinatesUtils.getAvailableCRS()[crs] || {label: crs}).label,
                coo.map(x => LocaleUtils.toLocaleFixed(x, decimals)).join(", ")
            ]);
        });

        if (this.state.elevation !== undefined && this.state.elevation !== null) {
            let elevs = this.state.elevation.list;
            if (!elevs) {
                elevs = [{elevation: this.state.elevation, dataset: null}];
            }
            for (const data of elevs) {
                info.push([
                    LocaleUtils.tr("mapinfotooltip.elevation") + (data.dataset ? " (" + data.dataset + ")" : ""),
                    data.elevation.toFixed(this.props.elevationPrecision) + " m"
                ]);
            }
        }

        if (this.state.extraInfo) {
            info.push(...this.state.extraInfo);
        }
        const title = LocaleUtils.tr("mapinfotooltip.title");
        const pixel = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK)(this.state.point.coordinate);
        const style = {
            left: (pixel[0]) + "px",
            top: (pixel[1]) + "px"
        };
        const text = info.map(entry => entry.join(": ")).join("\n");
        let routingButtons = null;
        if (ConfigUtils.havePlugin("Routing")) {
            const prec = CoordinatesUtils.getPrecision(this.props.map.displayCrs);
            const pos = CoordinatesUtils.reproject(this.state.point.coordinate, this.props.map.projection, this.props.map.displayCrs);
            const point = {
                text: pos.map(x => x.toFixed(prec)).join(", ") + " (" + this.props.map.displayCrs + ")",
                pos: [...pos],
                crs: this.props.map.displayCrs
            };
            routingButtons = (
                <table className="mapinfotooltip-body-routing">
                    <tbody>
                        <tr>
                            <td><b>{LocaleUtils.tr("routing.route")}:</b></td>
                            <td>
                                <div className="controlgroup">
                                    <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {from: point})}>{LocaleUtils.tr("routing.fromhere")}</button>
                                    <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {to: point})}>{LocaleUtils.tr("routing.tohere")}</button>
                                    <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {via: point})}>{LocaleUtils.tr("routing.addviapoint")}</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td><b>{LocaleUtils.tr("routing.reachability")}:</b></td>
                            <td>
                                <div className="controlgroup">
                                    <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {isocenter: point})}>{LocaleUtils.tr("routing.isocenter")}</button>
                                    <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {isoextracenter: point})}>{LocaleUtils.tr("routing.isoextracenter")}</button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        return ReactDOM.createPortal((
            <div className="mapinfotooltip" style={style}>
                <div className="mapinfotooltip-window">
                    <div className="mapinfotooltip-titlebar">
                        <span className="mapinfotooltip-title">{title}</span>
                        <CopyButton buttonClass="mapinfotooltip-button" text={text} />
                        <Icon className="mapinfotooltip-button" icon="remove" onClick={this.clear}/>
                    </div>
                    <div className="mapinfotooltip-body">
                        <table>
                            <tbody>
                                {info.map((entry, index) => (
                                    <tr key={"row" + index}>
                                        <td><b>{entry[0]}:</b></td>
                                        <td>{entry[1]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {routingButtons}
                        {this.props.plugins.map((Plugin, idx) => (<Plugin closePopup={this.clear} key={idx} point={this.state.point} projection={this.props.map.projection} />))}
                    </div>
                </div>
            </div>
        ), this.context);
    }
}

export default (plugins) => {
    return connect((state) => ({
        enabled: state.task.identifyEnabled,
        map: state.map,
        plugins: plugins
    }), {
        setCurrentTask: setCurrentTask
    })(MapInfoTooltip);
};

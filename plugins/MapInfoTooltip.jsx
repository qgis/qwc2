/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import axios from 'axios';
import {setCurrentTask} from '../actions/task';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import CopyButton from '../components/widgets/CopyButton';
import Icon from '../components/Icon';
import displayCrsSelector from '../selectors/displaycrs';
import './style/MapInfoTooltip.css';

class MapInfoTooltip extends React.Component {
    static propTypes = {
        displaycrs: PropTypes.string,
        elevationPrecision: PropTypes.number,
        enabled: PropTypes.bool,
        includeWGS84: PropTypes.bool,
        map: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        elevationPrecision: 0,
        includeWGS84: true
    };
    state = {
        coordinate: null, elevation: null, extraInfo: null
    };
    componentDidUpdate(prevProps) {
        if (!this.props.enabled && this.state.coordinate) {
            this.clear();
            return;
        }
        const newPoint = this.props.map.click;
        if (!newPoint || newPoint.button !== 2) {
            if (this.state.coordinate) {
                this.clear();
            }
        } else {
            const oldPoint = prevProps.map.click;
            if (!oldPoint || oldPoint.pixel[0] !== newPoint.pixel[0] || oldPoint.pixel[1] !== newPoint.pixel[1]) {
                this.setState({coordinate: newPoint.coordinate, elevation: null});
                const serviceParams = {pos: newPoint.coordinate.join(","), crs: this.props.map.projection};
                const elevationService = (ConfigUtils.getConfigProp("elevationServiceUrl") || "").replace(/\/$/, '');
                const elevationPrecision = prevProps.elevationPrecision;
                if (elevationService) {
                    axios.get(elevationService + '/getelevation', {params: serviceParams}).then(response => {
                        this.setState({elevation: Math.round(response.data.elevation * Math.pow(10, elevationPrecision)) / Math.pow(10, elevationPrecision)});
                    }).catch(() => {});
                }
                const mapInfoService = ConfigUtils.getConfigProp("mapInfoService");
                if (mapInfoService) {
                    axios.get(mapInfoService, {params: serviceParams}).then(response => {
                        this.setState({extraInfo: response.data.results});
                    }).catch(() => {});
                }
            }
        }
    }
    clear = () => {
        this.setState({coordinate: null, height: null, extraInfo: null});
    };
    render() {
        if (!this.state.coordinate) {
            return null;
        }

        const info = [];

        const projections = [this.props.displaycrs];
        if (!projections.includes(this.props.map.projection)) {
            projections.push(this.props.map.projection);
        }
        if (this.props.includeWGS84 && !projections.includes("EPSG:4326")) {
            projections.push("EPSG:4326");
        }
        projections.map(crs => {
            const coo = CoordinatesUtils.reproject(this.state.coordinate, this.props.map.projection, crs);
            const digits = CoordinatesUtils.getUnits(crs) === 'degrees' ? 4 : 0;
            info.push([
                (CoordinatesUtils.getAvailableCRS()[crs] || {label: crs}).label,
                coo.map(x => LocaleUtils.toLocaleFixed(x, digits)).join(", ")
            ]);
        });

        if (this.state.elevation) {
            info.push([
                LocaleUtils.tr("mapinfotooltip.elevation"),
                this.state.elevation + " m"
            ]);
        }

        if (this.state.extraInfo) {
            info.push(...this.state.extraInfo);
        }
        const title = LocaleUtils.tr("mapinfotooltip.title");
        const pixel = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK)(this.state.coordinate);
        const style = {
            left: pixel[0] + "px",
            top: pixel[1] + "px"
        };
        const text = info.map(entry => entry.join(": ")).join("\n");
        let routingButtons = null;
        if (ConfigUtils.havePlugin("Routing")) {
            const prec = CoordinatesUtils.getUnits(this.props.displaycrs) === 'degrees' ? 4 : 0;
            const pos = CoordinatesUtils.reproject(this.state.coordinate, this.props.map.projection, this.props.displaycrs);
            const point = {
                text: pos.map(x => x.toFixed(prec)).join(", ") + " (" + this.props.displaycrs + ")",
                pos: [...pos],
                crs: this.props.displaycrs
            };
            routingButtons = (
                <table className="mapinfotooltip-body-routing">
                    <tbody>
                        <tr>
                            <td><b>{LocaleUtils.tr("routing.route")}:</b></td>
                            <td>
                                <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {from: point})}>{LocaleUtils.tr("routing.fromhere")}</button>
                                <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {to: point})}>{LocaleUtils.tr("routing.tohere")}</button>
                                <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {via: point})}>{LocaleUtils.tr("routing.addviapoint")}</button>
                            </td>
                        </tr>
                        <tr>
                            <td><b>{LocaleUtils.tr("routing.reachability")}:</b></td>
                            <td>
                                <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {isocenter: point})}>{LocaleUtils.tr("routing.isocenter")}</button>
                                <button className="button" onClick={() => this.props.setCurrentTask("Routing", null, null, {isoextracenter: point})}>{LocaleUtils.tr("routing.isoextracenter")}</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
        return (
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
                    </div>
                </div>
            </div>
        );
    }
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    enabled: state.identify.tool !== null,
    map: state.map,
    displaycrs: displaycrs
}));

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(MapInfoTooltip);

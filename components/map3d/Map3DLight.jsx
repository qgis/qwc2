/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import suncalc from 'suncalc';
import {AmbientLight, DirectionalLight} from 'three';

import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import SideBar from '../SideBar';
import Input from '../widgets/Input';
import ToggleSwitch from '../widgets/ToggleSwitch';

import './style/Map3DLight.css';


export default class Map3DLight extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        systemTime: false,
        timestamp: 0
    };
    constructor(props) {
        super(props);
        this.setTimestampTimeout = null;
        const now = new Date();
        now.setHours(12);
        now.setMinutes(0);
        now.setSeconds(0);
        this.state.timestamp = +now;
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.scene !== prevProps.sceneContext?.scene) {
            const ambientLight = new AmbientLight('white', 0.5);
            this.props.sceneContext.addSceneObject("__ambientLight", ambientLight);

            const directionalLight = new DirectionalLight(0xffffff, 1.5);
            this.props.sceneContext.addSceneObject("__directionalLight", directionalLight);

            this.props.sceneContext.scene.view.controls.addEventListener('change', () => this.updateLightPosition());
            // Ensure light position is updated at least once per minute
            this.lightPositionInterval = setInterval(() => this.updateLightPosition(true), 1000 * 60);
            this.updateLightPosition();
        } else if (this.state.timestamp !== prevState.timestamp) {
            this.updateLightPosition(true);
        }
    }
    componentWillUnmount() {
        clearInterval(this.lightPositionInterval);
    }
    render() {
        return (
            <div>
                <SideBar icon="clock" id="DateTime3D"
                    title={LocaleUtils.tr("appmenu.items.DateTime3D")}
                    width="20em"
                >
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            </div>
        );
    }
    renderBody = () => {
        const date = new Date(this.state.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes() + date.getSeconds() > 30 ? 1 : 0).padStart(2, '0');
        const ymd = `${year}-${month}-${day}`;
        const hm = `${hours}:${minutes}`;
        return (
            <div className="datetime3d-body">
                <table>
                    <tbody>
                        <tr>
                            <td>System time</td>
                            <td><ToggleSwitch active={this.state.systemTime} onChange={this.toggleSystemTime} /></td>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td><Input disabled={this.state.systemTime} onChange={this.updateDate} type="date" value={ymd} /></td>
                        </tr>
                        <tr>
                            <td>Time</td>
                            <td><Input disabled={this.state.systemTime} onChange={this.updateTime} type="time" value={hm} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };
    toggleSystemTime = (active) => {
        if (active) {
            this.setCurrentTimestamp();
        } else {
            clearTimeout(this.setTimestampTimeout);
        }
        this.setState({systemTime: active});
    };
    updateDate = (value) => {
        if (!value) {
            return;
        }
        this.setState(state => {
            const date = new Date(state.timestamp);
            const ymd = value.split("-").map(Number);
            date.setFullYear(ymd[0]);
            date.setMonth(ymd[1] - 1);
            date.setDate(ymd[2]);
            return {timestamp: +date};
        });
    };
    updateTime = (value) => {
        if (!value) {
            return;
        }
        this.setState(state => {
            const date = new Date(state.timestamp);
            const hm = value.split(":").map(Number);
            date.setHours(hm[0]);
            date.setMinutes(hm[1]);
            return {timestamp: +date};
        });
    };
    setCurrentTimestamp = () => {
        // Set current timestamp and update it every minute
        const date = new Date();
        const secondsRemaining = 60 - date.getSeconds() - date.getMilliseconds() / 1000;
        this.setState({timestamp: +date});
        this.setTimestampTimeout = setTimeout(this.setCurrentTimestamp, 1000 * secondsRemaining);
    };
    updateLightPosition = (force = false) => {
        const sceneContext = this.props.sceneContext;
        const directionalLight = sceneContext.getSceneObject("__directionalLight");

        // Recompute light
        if (force || directionalLight.target.position.distanceTo(sceneContext.scene.view.controls.target) > 10000) {

            const x = sceneContext.scene.view.controls.target.x;
            const y = sceneContext.scene.view.controls.target.y;
            const wgsPos = CoordinatesUtils.reproject([x, y], sceneContext.mapCrs, "EPSG:4326");

            const sunPos = suncalc.getPosition(new Date(this.state.timestamp), wgsPos[1], wgsPos[0]);
            const az = sunPos.azimuth + Math.PI;
            const alt = sunPos.altitude;
            // Assume sun at 10000km distance
            const distance = 10000000;

            directionalLight.position.x = x + Math.cos(alt) * Math.sin(az) * distance;
            directionalLight.position.y = y + Math.cos(alt) * Math.cos(az) * distance;
            directionalLight.position.z = Math.sin(alt) * distance;
            directionalLight.updateMatrixWorld();

            directionalLight.target.position.x = x;
            directionalLight.target.position.y = y;
            directionalLight.target.position.z = 0;
            directionalLight.target.updateMatrixWorld();

            const alpha = Math.max(0, alt / (0.5 * Math.PI));
            const intensity = 1.15 * alpha / (alpha + 0.15);

            sceneContext.map.lighting.azimuth = az / Math.PI * 180; // Azimuth is measured from South
            sceneContext.map.lighting.zenith = 90 - intensity * 30;
            sceneContext.map.lighting.intensity = 1 - 0.4 * intensity;
            sceneContext.map.lighting.elevationLayersOnly = true;

            // Modulate light intensities based on sun altitude
            sceneContext.getSceneObject("__ambientLight").intensity = 0.01 + 0.49 * intensity;
            sceneContext.getSceneObject("__directionalLight").intensity = 0.1 + 1.4 * intensity;

            sceneContext.scene.notifyChange(sceneContext.map);
            sceneContext.scene.renderer.render(sceneContext.scene.scene, sceneContext.scene.view.camera);
        }
    };
}

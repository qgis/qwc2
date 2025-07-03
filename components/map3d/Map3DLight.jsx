/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import Sun from '@giro3d/giro3d/core/geographic/Sun.js';
import {MapLightingMode} from '@giro3d/giro3d/entities/MapLightingOptions';
import PropTypes from 'prop-types';
import suncalc from 'suncalc';
import {AmbientLight, BasicShadowMap, CameraHelper, DirectionalLight, DirectionalLightHelper, PCFShadowMap, PCFSoftShadowMap, VSMShadowMap} from 'three';

import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import Input from '../widgets/Input';
import NumberInput from '../widgets/NumberInput';
import ToggleSwitch from '../widgets/ToggleSwitch';

import './style/Map3DLight.css';


export default class Map3DLight extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        showAdvanced: false,
        lightParams: {
            day: 182,
            time: 720,
            helpersVisible: false,
            moonLightIntensity: 0.06,
            sunLightIntensity: 3.5,
            zFactor: 1,
            lightElevationLayersOnly: false,
            shadowsEnabled: true,
            shadowType: PCFShadowMap,
            shadowMapSize: 4096,
            shadowBias: -0.0001,
            sunDistance: 80000,
            normalBias: 0,
            shadowIntensity: 1.0,
            shadowVolumeNear: 60000,
            shadowVolumeFar: 100000
        },
        dayAnimation: false,
        dayAnimationSettings: false,
        dayStep: 30,
        timeAnimation: false,
        timeAnimationSettings: false,
        timeStep: 30
    };
    constructor(props) {
        super(props);
        this.state.lightParams.day = props.sceneContext.options.defaultDay;
        const parts = props.sceneContext.options.defaultTime.split(":").slice(0, 2).map(Number);
        this.state.lightParams.time = parts[0] * 60 + parts[1];
    }
    componentDidMount() {
        this.animationInterval = null;
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.scene !== prevProps.sceneContext?.scene) {
            const ambientLight = new AmbientLight(0xffffff, 1);
            this.props.sceneContext.addSceneObject("__ambientLight", ambientLight);

            const sunLight = new DirectionalLight(0xffffff, this.state.sunLightIntensity);
            this.props.sceneContext.addSceneObject("__sunLight", sunLight);

            const moonLight = new DirectionalLight(0xffffff, this.state.moonLightIntensity);
            this.props.sceneContext.addSceneObject("__moonLight", moonLight);

            if (this.state.lightParams.helpersVisible) {
                const sunLightHelper = new DirectionalLightHelper(sunLight, 200, 'white');
                this.props.sceneContext.addSceneObject("__sunLightHelper", sunLightHelper);

                const shadowCameraHelper = new CameraHelper(sunLight.shadow.camera);
                this.props.sceneContext.addSceneObject("__shadowCameraHelper", shadowCameraHelper);
            }

            this.props.sceneContext.scene.view.controls.addEventListener('change', this.setLighting);
            this.setLighting();
        } else if (this.state.lightParams !== prevState.lightParams) {
            if (this.state.lightParams.helpersVisible && !prevState.lightParams.helpersVisible) {
                const sunLight = this.props.sceneContext.getSceneObject("__sunLight");

                const sunLightHelper = new DirectionalLightHelper(sunLight, 200, 'white');
                this.props.sceneContext.addSceneObject("__sunLightHelper", sunLightHelper);

                const shadowCameraHelper = new CameraHelper(sunLight.shadow.camera);
                this.props.sceneContext.addSceneObject("__shadowCameraHelper", shadowCameraHelper);
            } else if (prevState.lightParams.helpersVisible && !this.state.lightParams.helpersVisible) {
                this.props.sceneContext.removeSceneObject("__sunLightHelper");
                this.props.sceneContext.removeSceneObject("__shadowCameraHelper");
            }
            this.setLighting();
        }
    }
    componentWillUnmount() {
        clearInterval(this.lightPositionInterval);
    }
    onHide = () => {
        clearInterval(this.animationInterval);
        this.setState({dayAnimation: false, timeAnimation: false});
    };
    render() {
        return (
            <SideBar icon="light" id="MapLight3D" onHide={this.onHide}
                title={LocaleUtils.tr("appmenu.items.MapLight3D")}
                width="25em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        const lightParams = this.state.lightParams;

        const dateValue = new Date(new Date().getFullYear(), 0, 1 + lightParams.day).toISOString().split("T")[0];
        const dateToDay = (date) => {
            const d = new Date(date + "T00:00:00");
            return (d - new Date(d.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24);
        };
        const isLeapYear = (year) => (new Date(year, 1, 29).getDate() === 29);

        const timeValue = `${String(Math.trunc(lightParams.time / 60)).padStart(2, '0')}:${String(lightParams.time % 60).padStart(2, '0')}`;
        const timeToMin = (time) => {
            const parts = time.split(":");
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        };
        return (
            <div className="maplight3d-body">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.date")}</td>
                            <td>
                                <div className="map3d-animation-slider">
                                    <Icon icon={this.state.dayAnimation ? "square" : "triangle-right"} onClick={this.toggleDayAnimation} />
                                    <div className="maplight3d-slider">
                                        <input max={365 + isLeapYear()} min={1} onChange={ev => this.updateLightParams("day", parseInt(ev.target.value, 10))} step={1} type="range" value={lightParams.day} />
                                        <Input onChange={value => this.updateLightParams("day", dateToDay(value))} type="date" value={dateValue} />
                                    </div>
                                    <Icon
                                        className={this.state.dayAnimationSettings ? "map3d-animation-settings-active" : ""}
                                        icon="cog"
                                        onClick={() => this.setState(state => ({dayAnimationSettings: !state.dayAnimationSettings}))} />
                                </div>
                            </td>
                        </tr>
                        {this.state.dayAnimationSettings ? (
                            <tr>
                                <td colSpan="2">
                                    <div className="maplight3d-animation-settings">
                                        <span>{LocaleUtils.tr("maplight3d.animationstep")}:</span>
                                        <NumberInput max={60} min={1} onChange={dayStep => this.setState({dayStep})} suffix={" " + LocaleUtils.tr("maplight3d.dayspersec")} value={this.state.dayStep} />
                                    </div>
                                </td>
                            </tr>
                        ) : null}
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.time")}</td>
                            <td>
                                <div className="map3d-animation-slider">
                                    <Icon icon={this.state.timeAnimation ? "square" : "triangle-right"} onClick={this.toggleTimeAnimation} />
                                    <div className="maplight3d-slider">
                                        <input max={1439} min={0} onChange={ev => this.updateLightParams("time", parseInt(ev.target.value, 10))} step={1} type="range" value={lightParams.time} />
                                        <Input onChange={value => this.updateLightParams("time", timeToMin(value))} type="time" value={timeValue} />
                                    </div>
                                    <Icon
                                        className={this.state.timeAnimationSettings ? "map3d-animation-settings-active" : ""}
                                        icon="cog"
                                        onClick={() => this.setState(state => ({timeAnimationSettings: !state.timeAnimationSettings}))} />
                                </div>
                            </td>
                        </tr>
                        {this.state.timeAnimationSettings ? (
                            <tr>
                                <td colSpan="2">
                                    <div className="maplight3d-animation-settings">
                                        <span>{LocaleUtils.tr("maplight3d.animationstep")}:</span>
                                        <NumberInput max={60} min={1} onChange={timeStep => this.setState({timeStep})} suffix={" " + LocaleUtils.tr("maplight3d.minspersec")} value={this.state.timeStep} />
                                    </div>
                                </td>
                            </tr>
                        ) : null}
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.sunLightIntensity")}</td>
                            <td>{this.renderSlider('sunLightIntensity', 0, 10, 0.1)}</td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.moonLightIntensity")}</td>
                            <td>{this.renderSlider('moonLightIntensity', 0, 0.5, 0.01)}</td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadows")}</td>
                            <td><ToggleSwitch active={lightParams.shadowsEnabled} onChange={value => this.updateLightParams('shadowsEnabled', value)} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadowintensity")}</td>
                            <td>{this.renderSlider('shadowIntensity', 0, 2, 0.1)}</td>
                        </tr>
                        <tr>
                            <td className="maplight3d-advanced" colSpan="2">
                                <label>
                                    <input checked={this.state.showAdvanced} onChange={ev => this.setState(state => ({showAdvanced: !state.showAdvanced}))} type="checkbox" /> {LocaleUtils.tr("maplight3d.showadvanced")}</label>
                            </td>
                        </tr>
                        {this.state.showAdvanced ? [(
                            <tr key="helpersVisible">
                                <td>{LocaleUtils.tr("maplight3d.helpersVisible")}</td>
                                <td><ToggleSwitch active={lightParams.helpersVisible} onChange={value => this.updateLightParams('helpersVisible', value)} /></td>
                            </tr>
                        ), (
                            <tr key="zFactor">
                                <td>{LocaleUtils.tr("maplight3d.zFactor")}</td>
                                <td><input max={10} min={0} onChange={ev => this.updateLightParams('zFactor', ev.target.value)} step={0.1} type="range" value={lightParams.zFactor} /></td>
                            </tr>
                        ), (
                            <tr key="shadowType">
                                <td>{LocaleUtils.tr("maplight3d.shadowType")}</td>
                                <td>
                                    <select onChange={ev => this.updateLightParams('shadowType', parseInt(ev.target.value, 10))} value={lightParams.shadowType}>
                                        <option value={BasicShadowMap}>BasicShadowMap</option>
                                        <option value={PCFShadowMap}>PCFShadowMap</option>
                                        <option value={PCFSoftShadowMap}>PCFSoftShadowMap</option>
                                        <option value={VSMShadowMap}>VSMShadowMap</option>
                                    </select>
                                </td>
                            </tr>
                        ), (
                            <tr key="shadowMapSize">
                                <td>{LocaleUtils.tr("maplight3d.shadowMapSize")}</td>
                                <td><NumberInput decimals={0} max={8192} min={64} onChange={value => this.updateLightParams('shadowMapSize', value)} value={lightParams.shadowMapSize} /></td>
                            </tr>
                        ), (
                            <tr key="shadowBias">
                                <td>{LocaleUtils.tr("maplight3d.shadowBias")}</td>
                                <td><NumberInput decimals={5} max={0.01} min={-0.01} onChange={value => this.updateLightParams('shadowBias', value)} value={lightParams.shadowBias} /></td>
                            </tr>
                        ), (
                            <tr key="normalBias">
                                <td>{LocaleUtils.tr("maplight3d.normalBias")}</td>
                                <td><NumberInput decimals={1} max={10} min={-10} onChange={value => this.updateLightParams('normalBias', value)} value={lightParams.normalBias} /></td>
                            </tr>
                        ), (
                            <tr key="shadowVolumeNear">
                                <td>{LocaleUtils.tr("maplight3d.shadowVolumeNear")}</td>
                                <td><NumberInput decimals={0} max={100000} min={100} onChange={value => this.updateLightParams('shadowVolumeNear', value)} value={lightParams.shadowVolumeNear} /></td>
                            </tr>
                        ), (
                            <tr key="shadowVolumeFar">
                                <td>{LocaleUtils.tr("maplight3d.shadowVolumeFar")}</td>
                                <td><NumberInput decimals={0} max={100000} min={100} onChange={value => this.updateLightParams('shadowVolumeFar', value)} value={lightParams.shadowVolumeFar} /></td>
                            </tr>
                        )] : null}
                    </tbody>
                </table>
            </div>
        );
    };
    toggleDayAnimation = () => {
        this.setState(state => ({dayAnimation: !state.dayAnimation, timeAnimation: false}), () => {
            clearInterval(this.animationInterval);
            if (this.state.dayAnimation) {
                this.animationInterval = setInterval(() => {
                    this.updateLightParams('day', (this.state.lightParams.day + this.state.dayStep / 10) % 365);
                }, 100);
            }
        });
    };
    toggleTimeAnimation = () => {
        this.setState(state => ({timeAnimation: !state.timeAnimation, dayAnimation: false}), () => {
            clearInterval(this.animationInterval);
            if (this.state.timeAnimation) {
                this.animationInterval = setInterval(() => {
                    this.updateLightParams('time', (this.state.lightParams.time + this.state.timeStep / 10) % 1440);
                }, 100);
            }
        });
    };
    renderSlider = (key, min, max, step, labelFormatter = undefined) => {
        const value = this.state.lightParams[key];
        const parseValue = (x) => Number.isInteger(step) ? parseInt(x, 10) : parseFloat(x);
        labelFormatter = labelFormatter ?? (x => x.toFixed(-Math.log10(step)));
        return (
            <div className="maplight3d-slider">
                <input max={max} min={min} onChange={ev => this.updateLightParams(key, parseValue(ev.target.value))} step={step} type="range" value={value} />
                <div className="maplight3d-slider-label">
                    <span style={{left: ((value - min) * 100 / (max - min)) + "%"}}>
                        {labelFormatter(value)}
                    </span>
                </div>
            </div>
        );
    };
    updateLightParams = (key, value) => {
        this.setState(state => ({lightParams: {...state.lightParams, [key]: value}}));
    };
    configureShadows = (sunLight, lightParams, shadowIntensityK) => {
        if (!lightParams.shadowsEnabled) {
            this.props.sceneContext.scene.renderer.shadowMap.enabled = false;
            sunLight.castShadow = false;
            return;
        }
        const cameraHeight = this.props.sceneContext.scene.view.camera.position.z;
        const targetHeight = this.props.sceneContext.scene.view.controls.target.z;
        const volumeSize = Math.min(20000, Math.max(1000, cameraHeight - targetHeight));

        sunLight.shadow.camera.top = volumeSize;
        sunLight.shadow.camera.bottom = -volumeSize;
        sunLight.shadow.camera.left = -volumeSize;
        sunLight.shadow.camera.right = volumeSize;
        sunLight.shadow.camera.near = lightParams.shadowVolumeNear;
        sunLight.shadow.camera.far = lightParams.shadowVolumeFar;
        sunLight.shadow.camera.updateProjectionMatrix();

        sunLight.shadow.mapSize.set(lightParams.shadowMapSize, lightParams.shadowMapSize);
        sunLight.shadow.bias = lightParams.shadowBias;
        sunLight.shadow.normalBias = lightParams.normalBias;
        sunLight.shadow.intensity = lightParams.shadowIntensity * shadowIntensityK;

        this.props.sceneContext.scene.renderer.shadowMap.enabled = true;
        sunLight.castShadow = true;
    };
    setLighting = () => {
        const sceneContext = this.props.sceneContext;
        const lightParams = this.state.lightParams;

        const ambientLight = sceneContext.getSceneObject("__ambientLight");
        const sunLight = sceneContext.getSceneObject("__sunLight");
        const moonLight = sceneContext.getSceneObject("__moonLight");

        const lightTarget = sceneContext.scene.view.controls.target.clone();
        lightTarget.z = 0;

        // Compute azimuth / zenith and sun position
        const date = new Date(new Date().getFullYear(), 0, lightParams.day, Math.trunc(lightParams.time / 60), lightParams.time % 60);
        const latlon = CoordinatesUtils.reproject([lightTarget.x, lightTarget.y], sceneContext.mapCrs, 'EPSG:4326');
        const sunPos = suncalc.getPosition(date, latlon[1], latlon[0]);
        const zenith = Math.min(90, 90 - sunPos.altitude / Math.PI * 180);
        const azimuth = 180 + sunPos.azimuth / Math.PI * 180;
        const sunLocalPos = Sun.getLocalPosition({
            point: lightTarget,
            zenith: zenith,
            azimuth: azimuth,
            distance: lightParams.sunDistance
        });

        // Compute dynamic params
        const noonColor = { r: 1.0, g: 0.98, b: 0.98 };
        const horizonColor = { r: 1.0, g: 0.5, b: 0.3 };

        const fade = Math.pow(zenith / 90, 3);
        const sunColor = {
            r: (1 - fade) * noonColor.r + fade * horizonColor.r,
            g: (1 - fade) * noonColor.g + fade * horizonColor.g,
            b: (1 - fade) * noonColor.b + fade * horizonColor.b
        };
        const ambientIntensity = (1 - zenith / 90) * 1.5;
        const shadowIntensityK = (1 - fade) * 0.9 + 0.2 * fade;
        const sunLightIntensityK = Math.min(1, (90 - zenith) / 3);

        // Set lighting params
        sceneContext.map.lighting.enabled = true;
        sceneContext.map.lighting.mode = lightParams.shadowsEnabled ? MapLightingMode.LightBased : MapLightingMode.Hillshade;
        sceneContext.map.lighting.elevationLayersOnly = lightParams.lightElevationLayersOnly;
        sceneContext.map.lighting.hillshadeAzimuth = azimuth;
        sceneContext.map.lighting.hillshadeZenith = zenith;
        sceneContext.map.lighting.zFactor = lightParams.zFactor;
        sceneContext.scene.notifyChange(sceneContext.map);

        sceneContext.scene.renderer.shadowMap.type = lightParams.shadowType;

        ambientLight.intensity = ambientIntensity;

        sunLight.position.copy(sunLocalPos);
        sunLight.intensity = lightParams.sunLightIntensity * sunLightIntensityK;
        sunLight.color = sunColor;
        sunLight.target.position.copy(lightTarget);
        sunLight.updateMatrixWorld(true);
        sunLight.target.updateMatrixWorld(true);

        this.configureShadows(sunLight, lightParams, shadowIntensityK);

        // NOTE: just a top-down light
        moonLight.position.set(lightTarget.x, lightTarget.y, 8000);
        moonLight.intensity = lightParams.moonLightIntensity * (1 - sunLightIntensityK);
        moonLight.target.position.copy(lightTarget);
        moonLight.updateMatrixWorld(true);
        moonLight.target.updateMatrixWorld(true);

        if (lightParams.helpersVisible) {
            const sunLightHelper = sceneContext.getSceneObject("__sunLightHelper");
            sunLightHelper.update();
            sunLightHelper.updateMatrixWorld(true);

            const shadowCameraHelper = sceneContext.getSceneObject("__shadowCameraHelper");
            shadowCameraHelper.update();
            shadowCameraHelper.updateMatrixWorld(true);
        }

        sceneContext.scene.notifyChange();
    };
}

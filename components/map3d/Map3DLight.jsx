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
            ambientLightIntensity: 2.1,
            directionalLightIntensity: 1.8,
            zFactor: 1,
            lightElevationLayersOnly: false,
            shadowsEnabled: true,
            shadowType: PCFShadowMap,
            shadowMapSize: 4096,
            shadowBias: -0.0001,
            sunDistance: 80000,
            normalBias: 0,
            shadowIntensity: 0.9,
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
    componentDidMount() {
        this.animationInterval = null;
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.scene !== prevProps.sceneContext?.scene) {
            const ambientLight = new AmbientLight(0xffffff, this.state.ambientLightIntensity);
            this.props.sceneContext.addSceneObject("__ambientLight", ambientLight);

            const directionalLight = new DirectionalLight(0xffffff, this.state.directionalLightIntensity);
            directionalLight.castShadow = true;
            this.props.sceneContext.addSceneObject("__directionalLight", directionalLight);

            const directionalLightHelper = new DirectionalLightHelper(directionalLight, 200, 'white');
            this.props.sceneContext.addSceneObject("__directionalLightHelper", directionalLightHelper);
            directionalLightHelper.visible = this.state.lightParams.helpersVisible;

            const shadowCameraHelper = new CameraHelper(directionalLight.shadow.camera);
            this.props.sceneContext.addSceneObject("__shadowCameraHelper", shadowCameraHelper);
            shadowCameraHelper.visible = this.state.lightParams.helpersVisible;

            this.props.sceneContext.scene.view.controls.addEventListener('change', this.setLighting);
            this.setLighting();
        } else if (this.state.lightParams !== prevState.lightParams) {
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
            <div>
                <SideBar icon="light" id="MapLight3D" onHide={this.onHide}
                    title={LocaleUtils.tr("appmenu.items.MapLight3D")}
                    width="25em"
                >
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            </div>
        );
    }
    renderBody = () => {
        const lightParams = this.state.lightParams;
        const dateFormatter = (day) => {
            const date = new Date(new Date().getFullYear(), 0, day);
            return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
        };
        const timeFormatter = (time) => {
            return `${String(Math.trunc(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
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
                                    {this.renderSlider('day', 1, 365, 1, dateFormatter)}
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
                                    {this.renderSlider('time', 0, 1439, 1, timeFormatter)}
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
                            <td>{LocaleUtils.tr("maplight3d.ambientLightIntensity")}</td>
                            <td>{this.renderSlider('ambientLightIntensity', 0, 5, 0.1)}</td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.directionalLightIntensity")}</td>
                            <td>{this.renderSlider('directionalLightIntensity', 0, 10, 0.1)}</td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadows")}</td>
                            <td><ToggleSwitch active={lightParams.shadowsEnabled} onChange={value => this.updateLightParams('shadowsEnabled', value)} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadowintensity")}</td>
                            <td><NumberInput decimals={1} disabled={!lightParams.shadowsEnabled} max={2} min={0} onChange={value => this.updateLightParams('shadowIntensity', value)} value={lightParams.shadowIntensity} /></td>
                        </tr>
                        <tr>
                            <td className="maplight3d-advanced" colSpan="2">
                                <label>
                                    <input onChange={ev => this.setState(state => ({showAdvanced: !state.showAdvanced}))} type="checkbox" value={this.state.showAdvanced} /> {LocaleUtils.tr("maplight3d.showadvanced")}</label>
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
                                <td><NumberInput decimals={4} max={0.01} min={-0.01} onChange={value => this.updateLightParams('shadowBias', value)} value={lightParams.shadowBias} /></td>
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
    computeShadowVolume = (directionalLight, lightParams) => {
        if (!lightParams.shadowsEnabled) {
            this.props.sceneContext.scene.renderer.shadowMap.enabled = false;
            return;
        }
        const cameraHeight = this.props.sceneContext.scene.view.camera.position.z;
        const targetHeight = this.props.sceneContext.scene.view.controls.target.z;
        const volumeSize = Math.min(20000, Math.max(1000, cameraHeight - targetHeight));

        directionalLight.shadow.camera.top = volumeSize;
        directionalLight.shadow.camera.bottom = -volumeSize;
        directionalLight.shadow.camera.left = -volumeSize;
        directionalLight.shadow.camera.right = volumeSize;
        directionalLight.shadow.camera.near = lightParams.shadowVolumeNear;
        directionalLight.shadow.camera.far = lightParams.shadowVolumeFar;

        this.props.sceneContext.scene.renderer.shadowMap.enabled = true;
    };
    setLighting = () => {
        const sceneContext = this.props.sceneContext;
        const lightParams = this.state.lightParams;

        const ambientLight = sceneContext.getSceneObject("__ambientLight");
        const directionalLight = sceneContext.getSceneObject("__directionalLight");
        const directionalLightHelper = sceneContext.getSceneObject("__directionalLightHelper");
        const shadowCameraHelper = sceneContext.getSceneObject("__shadowCameraHelper");

        const lightTarget = sceneContext.scene.view.controls.target.clone();
        lightTarget.z = 0;

        // Compute azimuth / zenith and sun position
        const date = new Date(new Date().getFullYear(), 0, lightParams.day, Math.trunc(lightParams.time / 60), lightParams.time % 60);
        const latlon = CoordinatesUtils.reproject([lightTarget.x, lightTarget.y], sceneContext.mapCrs, 'EPSG:4326');
        const sunPos = suncalc.getPosition(date, latlon[1], latlon[0]);
        const zenith = 90 - sunPos.altitude / Math.PI * 180;
        const azimuth = 180 + sunPos.azimuth / Math.PI * 180;
        const sunLocalPos = Sun.getLocalPosition({
            point: lightTarget,
            zenith: zenith,
            azimuth: azimuth,
            distance: lightParams.sunDistance
        });
        directionalLight.position.copy(sunLocalPos);

        // Set lighting params
        sceneContext.map.lighting.enabled = true;
        sceneContext.map.lighting.mode = lightParams.shadowsEnabled ? MapLightingMode.LightBased : MapLightingMode.Hillshade;
        sceneContext.map.lighting.elevationLayersOnly = lightParams.lightElevationLayersOnly;
        sceneContext.map.lighting.hillshadeAzimuth = azimuth;
        sceneContext.map.lighting.hillshadeZenith = zenith;
        sceneContext.map.lighting.zFactor = lightParams.zFactor;
        sceneContext.scene.notifyChange(sceneContext.map);

        sceneContext.scene.renderer.shadowMap.type = lightParams.shadowType;

        const zenithAttenuation = Math.pow(zenith / 90, 4);
        ambientLight.intensity = lightParams.ambientLightIntensity - 3 * zenithAttenuation;
        directionalLight.intensity = lightParams.directionalLightIntensity - 0.5 * zenithAttenuation;
        directionalLight.shadow.mapSize.set(lightParams.shadowMapSize, lightParams.shadowMapSize);
        directionalLight.shadow.bias = lightParams.shadowBias;
        directionalLight.shadow.normalBias = lightParams.normalBias;
        directionalLight.shadow.intensity = lightParams.shadowIntensity;
        directionalLight.target.position.copy(lightTarget);

        this.computeShadowVolume(directionalLight, lightParams);

        // Update scene
        directionalLight.updateMatrixWorld(true);
        directionalLight.target.updateMatrixWorld(true);
        directionalLight.shadow.updateMatrices(directionalLight);
        directionalLight.shadow.camera.updateProjectionMatrix();
        directionalLight.shadow.camera.updateMatrix();

        directionalLightHelper.visible = lightParams.helpersVisible;
        directionalLightHelper.update();
        directionalLightHelper.updateMatrixWorld(true);

        shadowCameraHelper.visible = lightParams.helpersVisible;
        shadowCameraHelper.update();
        shadowCameraHelper.updateMatrixWorld(true);

        sceneContext.scene.notifyChange();
    };
}

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
import {AmbientLight, BasicShadowMap, CameraHelper, DirectionalLight, DirectionalLightHelper, PCFShadowMap, PCFSoftShadowMap, Vector3, VSMShadowMap} from 'three';

import LocaleUtils from '../../utils/LocaleUtils';
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
            helpersVisible: false,
            ambientLightIntensity: 2.1,
            directionalLightIntensity: 1.8,
            sunAzimuth: 252,
            sunZenith: 45,
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
        }
    };
    componentDidMount() {
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

            this.props.sceneContext.scene.view.controls.addEventListener('change', () => this.setLightPosition());
            this.setLightShadowParams();
        } else if (this.state.lightParams !== prevState.lightParams) {
            this.setLightShadowParams();
        }
    }
    componentWillUnmount() {
        clearInterval(this.lightPositionInterval);
    }
    render() {
        return (
            <div>
                <SideBar icon="light" id="MapLight3D"
                    title={LocaleUtils.tr("appmenu.items.MapLight3D")}
                    width="30em"
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
        return (
            <div className="maplight3d-body">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.sunazimuth")}</td>
                            <td><input max={359} min={0} onChange={ev => this.updateLightParams('sunAzimuth', ev.target.value)} step={0.1} type="range" value={lightParams.sunAzimuth} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.sunzenith")}</td>
                            <td><input max={90} min={0} onChange={ev => this.updateLightParams('sunZenith', ev.target.value)} step={0.1} type="range" value={lightParams.sunZenith} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.ambientLightIntensity")}</td>
                            <td><input max={5} min={0} onChange={ev => this.updateLightParams('ambientLightIntensity', ev.target.value)} step={0.1} type="range" value={lightParams.ambientLightIntensity} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.directionalLightIntensity")}</td>
                            <td><input max={10} min={0} onChange={ev => this.updateLightParams('directionalLightIntensity', ev.target.value)} step={0.1} type="range" value={lightParams.directionalLightIntensity} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadows")}</td>
                            <td><ToggleSwitch active={lightParams.shadowsEnabled} onChange={value => this.updateLightParams('shadowsEnabled', value)} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("maplight3d.shadowintensity")}</td>
                            <td><NumberInput decimals={1} disabled={!lightParams.shadowsEnabled} max={1} min={0} onChange={value => this.updateLightParams('shadowIntensity', value)} value={lightParams.shadowIntensity} /></td>
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
    setLightPosition = (force = false) => {
        const sceneContext = this.props.sceneContext;
        const directionalLight = sceneContext.getSceneObject("__directionalLight");
        const directionalLightHelper = sceneContext.getSceneObject("__directionalLightHelper");
        const shadowCameraHelper = sceneContext.getSceneObject("__shadowCameraHelper");
        const lightTarget = sceneContext.scene.view.controls.target.clone();
        lightTarget.z = 0;

        // Recompute light
        const lightParams = this.state.lightParams;
        const pos = Sun.getLocalPosition({
            point: lightTarget,
            zenith: lightParams.sunZenith,
            azimuth: lightParams.sunAzimuth,
            distance: lightParams.sunDistance
        });
        directionalLight.position.copy(pos);
        directionalLight.target.position.copy(lightTarget);

        this.computeShadowVolume(directionalLight, lightParams);

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
    setLightShadowParams = () => {
        const sceneContext = this.props.sceneContext;
        const lightParams = this.state.lightParams;

        const ambientLight = sceneContext.getSceneObject("__ambientLight");
        const directionalLight = sceneContext.getSceneObject("__directionalLight");

        sceneContext.map.lighting.enabled = true;
        sceneContext.map.lighting.mode = lightParams.shadowsEnabled ? MapLightingMode.LightBased : MapLightingMode.Hillshade;
        sceneContext.map.lighting.elevationLayersOnly = lightParams.lightElevationLayersOnly;
        sceneContext.map.lighting.hillshadeAzimuth = lightParams.sunAzimuth;
        sceneContext.map.lighting.hillshadeZenith = lightParams.sunZenith;
        sceneContext.map.lighting.zFactor = lightParams.zFactor;
        sceneContext.scene.notifyChange(sceneContext.map);

        sceneContext.scene.renderer.shadowMap.type = lightParams.shadowType;

        const zenithAttenuation = Math.pow(lightParams.sunZenith / 90, 4);
        ambientLight.intensity = lightParams.ambientLightIntensity - 3 * zenithAttenuation;
        directionalLight.intensity = lightParams.directionalLightIntensity - 0.5 * zenithAttenuation;
        directionalLight.shadow.mapSize.set(lightParams.shadowMapSize, lightParams.shadowMapSize);
        directionalLight.shadow.bias = lightParams.shadowBias;
        directionalLight.shadow.normalBias = lightParams.normalBias;
        directionalLight.shadow.intensity = lightParams.shadowIntensity;

        this.setLightPosition();
    };
}

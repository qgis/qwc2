/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classNames from 'classnames';
import PropTypes from 'prop-types';
import {Vector3} from 'three';

import ConfigUtils from '../../utils/ConfigUtils';
import {UrlParams} from '../../utils/PermaLinkUtils';
import Icon from '../Icon';
import FirstPersonControls3D from './utils/FirstPersonControls3D';
import OrbitControls3D from './utils/OrbitControls3D';

import './style/MapControls3D.css';

// FIXME: camera.fov is 30, but in reality seems to be 50 (as would be the threejs default)
const CAMERA_FOV = 50;

class MapControls3D extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.string,
        onCameraChanged: PropTypes.func,
        onControlsSet: PropTypes.func,
        sceneContext: PropTypes.object
    };
    state = {
        pickingFirstPerson: false,
        firstPerson: false
    };
    constructor(props) {
        super(props);
        const sceneElement = props.sceneContext.scene.domElement;
        sceneElement.tabIndex = 0;

        this.controls = new OrbitControls3D(props.sceneContext.scene.view.camera);
        this.fpcontrols = new FirstPersonControls3D(props.sceneContext.scene.view.camera);
        this.controls.connect(props.sceneContext);

        const targetPos = props.sceneContext.scene.view.camera.position.clone();
        targetPos.z = 0;
        this.controls.target = targetPos;
        this.controls.addEventListener('change', this.updateUrlParams);
        this.fpcontrols.addEventListener('change', this.updateFpUrlParams);

        sceneElement.addEventListener('dblclick', this.switchToFirstPersonView);
        props.onControlsSet(this);
        this.updateUrlParams();
    }
    unload = (el) => {
        // componentWillUnmount is called too early, so do cleanup when the element is actually removed
        if (!el) {
            this.controls.removeEventListener('change', this.updateControlsTarget);
            this.fpcontrols.removeEventListener('change', this.updateFpUrlParams);
            if (this.state.firstPerson) {
                this.fpcontrols.disconnect();
            } else {
                this.controls.disconnect();
            }
            this.props.sceneContext.scene.domElement.removeEventListener('dblclick', this.switchToFirstPersonView);
        }
    };
    render() {
        const firstPersonButtonClasses = classNames({
            "map3d-firstperson-button": true,
            "map3d-firstperson-button-active": this.state.firstPerson
        });
        return [
            this.props.children,
            (
                <div className="map3d-nav" key="MapControls3D" ref={this.unload}>
                    <div className="map3d-nav-pan" key="MapPanWidget">
                        <span />
                        <Icon icon="chevron-up" onPointerDown={(ev) => this.pan(ev, 0, 1)} />
                        <span />
                        <Icon icon="chevron-left" onPointerDown={(ev) => this.pan(ev, -1, 0)} />
                        <Icon icon="home" onClick={() => this.home()} />
                        <Icon icon="chevron-right" onPointerDown={(ev) => this.pan(ev, 1, 0)} />
                        <span />
                        <Icon icon="chevron-down" onPointerDown={(ev) => this.pan(ev, 0, -1)} />
                        <span />
                    </div>
                    <div className="map3d-nav-rotate" key="MapRotateWidget">
                        <span />
                        <Icon icon="tilt-up" onPointerDown={(ev) => this.tilt(ev, 0, 0.1)} />
                        <span />
                        <Icon icon="tilt-left" onPointerDown={(ev) => this.tilt(ev, 0.1, 0)} />
                        <Icon icon="point" onClick={() => this.resetTilt()} />
                        <Icon icon="tilt-right" onPointerDown={(ev) => this.tilt(ev, -0.1, 0)} />
                        <span />
                        <Icon icon="tilt-down" onPointerDown={(ev) => this.tilt(ev, 0, -0.1)} />
                        <span />
                    </div>
                    {!this.state.firstPerson ? (
                        <div className="map3d-nav-zoom">
                            <div onPointerDown={(ev) => this.zoom(ev, +1)}><Icon icon="plus" /></div>
                            <div onPointerDown={(ev) => this.zoom(ev, -1)}><Icon icon="minus" /></div>
                        </div>
                    ) : null}
                    <div className={firstPersonButtonClasses} key="FirstPersonButton" onClick={this.toggleFirstPersonControls}>
                        <Icon icon="person" />
                    </div>
                </div>
            )
        ];
    }
    switchToFirstPersonView = (ev) => {
        // Don't do anything if a task is set, may interfere
        if (!this.props.currentTask && !this.state.firstPerson) {
            this.setupFirstPerson(ev);
        }
    };
    toggleFirstPersonControls = () => {
        if (this.state.firstPerson) {
            this.leaveFirstPerson();
        } else if (this.state.pickingFirstPerson) {
            this.props.sceneContext.scene.domElement.removeEventListener('click', this.setupFirstPerson);
            this.props.sceneContext.scene.domElement.style.cursor = '';
            this.setState({pickingFirstPerson: false});
        } else {
            this.props.sceneContext.scene.domElement.addEventListener('click', this.setupFirstPerson, {once: true});
            const cursor = ConfigUtils.getAssetsPath() + "/img/person.svg";
            this.props.sceneContext.scene.domElement.style.cursor = `url(${cursor}), pointer`;
            this.setState({pickingFirstPerson: true});
        }
    };
    setupFirstPerson = (ev) => {
        this.props.sceneContext.scene.domElement.style.cursor = '';

        const rect = ev.target.getBoundingClientRect();
        const mouseX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        const intersection = this.props.sceneContext.getSceneIntersection(mouseX, mouseY, false);
        if (!intersection) {
            return;
        }
        const pos = intersection.point;
        this.props.sceneContext.getTerrainHeightFromDTM([pos.x, pos.y]).then(z => {
            const camerapos = new Vector3(pos.x, pos.y, z + this.fpcontrols.personHeight);
            const targetpos = new Vector3(pos.x, pos.y + 300, z + this.fpcontrols.personHeight);
            this.controls.animateTo(camerapos, targetpos, 0, () => {
                this.controls.disconnect();
                this.fpcontrols.connect(this.props.sceneContext);
                this.fpcontrols.setView(camerapos, new Vector3(0, 1, 0));
                this.setState({firstPerson: true, pickingFirstPerson: false});
            });
        });
    };
    leaveFirstPerson = () => {
        if (this.state.firstPerson) {
            this.setState({firstPerson: false}, () => {
                // Need to ensure this.state.firstPerson is false to avoid endless loop
                const camerapos = this.props.sceneContext.scene.view.camera.position;
                this.fpcontrols.disconnect();
                this.controls.connect(this.props.sceneContext);
                this.controls.setView(camerapos, new Vector3().addVectors(camerapos, this.fpcontrols.lookAt));
                const bounds = [camerapos.x - 750, camerapos.y - 750, camerapos.x + 750, camerapos.y + 750];
                this.setViewToExtent(bounds);
            });
        }
    };
    home = () => {
        const extent = this.props.sceneContext.map.extent;
        const bounds = [extent.west, extent.south, extent.east, extent.north];
        this.setViewToExtent(bounds);
    };
    setViewToExtent = (bounds, angle = 0) => {
        this.leaveFirstPerson();

        const center = {
            x: 0.5 * (bounds[0] + bounds[2]),
            y: 0.5 * (bounds[1] + bounds[3])
        };
        center.z = this.props.sceneContext.getTerrainHeightFromMap([center.x, center.y]) ?? 0;

        // Camera height to width bbox width
        const fov = CAMERA_FOV / 180 * Math.PI;
        const cameraHeight = (bounds[2] - bounds[0]) / (2 * Math.tan(fov / 2));

        const camerapos = new Vector3(center.x, center.y, center.z + cameraHeight);
        const target = new Vector3(center.x, center.y, center.z);
        this.controls.animateTo(camerapos, target, angle);
    };
    pan = (ev, dx, dy) => {
        const panInterval = setInterval(() => {
            this.props.sceneContext.scene.view.controls.panView(dx, dy);
        }, 50);
        ev.view.addEventListener('pointerup', () => {
            clearInterval(panInterval);
        }, {once: true});
    };
    tilt = (ev, azimuth, polar) => {
        const tiltInterval = setInterval(() => {
            this.props.sceneContext.scene.view.controls.tiltView(azimuth, polar);
        }, 50);
        ev.view.addEventListener('pointerup', () => {
            clearInterval(tiltInterval);
        }, {once: true});
    };
    resetTilt = () => {
        const camerapos = this.props.sceneContext.scene.view.camera.position;
        if (this.state.firstPerson) {
            const newLookAt = this.fpcontrols.lookAt.clone();
            newLookAt.z = 0;
            this.fpcontrols.setView(camerapos, newLookAt.normalize());
        } else {
            const target = this.controls.target;
            const newcamerapos = new Vector3(target.x, target.y, target.distanceTo(camerapos));
            this.controls.animateTo(newcamerapos, target, 0);
        }
    };
    zoom = (ev, delta) => {
        const zoomInterval = setInterval(() => {
            const camerapos = this.props.sceneContext.scene.view.camera.position;
            const target = this.controls.target;
            const k = Math.min(150, Math.sqrt(target.distanceTo(camerapos)));
            this.props.sceneContext.scene.view.controls.zoomView(delta * k);
        }, 50);
        ev.view.addEventListener('pointerup', () => {
            clearInterval(zoomInterval);
        }, {once: true});
    };
    updateUrlParams = () => {
        const cpos = this.props.sceneContext.scene.view.camera.position;
        const tpos = this.controls.target;
        UrlParams.updateParams({v3d: [cpos.x, cpos.y, cpos.z, tpos.x, tpos.y, tpos.z, 0].map(v => v.toFixed(1)).join(",")});
        this.props.onCameraChanged([tpos.x, tpos.y, tpos.z], [cpos.x, cpos.y, cpos.z], CAMERA_FOV);
    };
    updateFpUrlParams = () => {
        const cpos = this.fpcontrols.target;
        const lkat = this.fpcontrols.lookAt;
        const h = this.fpcontrols.personHeight;
        UrlParams.updateParams({v3d: [cpos.x, cpos.y, cpos.z, lkat.x, lkat.y, lkat.z, h].map(v => v.toFixed(1)).join(",")});
        this.props.onCameraChanged([cpos.x, cpos.y, cpos.z], null);
    };
    restoreView = (viewState) => {
        if (viewState.camera && viewState.target) {
            const camera = new Vector3(...viewState.camera);
            const target = new Vector3(...viewState.target);

            if (viewState.personHeight > 0) {
                this.controls.disconnect();
                this.fpcontrols.connect(this.props.sceneContext);
                this.fpcontrols.setView(camera, target, viewState.personHeight);
                this.setState({firstPerson: true});
            } else {
                this.controls.setView(camera, target);
            }
        }
    };
}

export default connect((state) => ({
    currentTask: state.task.id
}), {
})(MapControls3D);

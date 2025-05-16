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
import {Raycaster, Vector2, Vector3} from 'three';
import {MapControls} from 'three/addons/controls/MapControls';

import ConfigUtils from '../../utils/ConfigUtils';
import {UrlParams} from '../../utils/PermaLinkUtils';
import Icon from '../Icon';
import {setCenter} from './slices/map3d';

import './style/MapControls3D.css';


class MapControls3D extends React.Component {
    static propTypes = {
        currentTask: PropTypes.string,
        onControlsSet: PropTypes.func,
        sceneContext: PropTypes.object,
        setCenter: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.animationInterrupted = false;
        this.personHeight = 2;
        this.prevTarget = null;
    }
    state = {
        firstPerson: false
    };
    componentDidMount() {
        const sceneElement = this.props.sceneContext.scene.domElement;
        sceneElement.tabIndex = 0;
        this.controls = new MapControls(this.props.sceneContext.scene.view.camera, sceneElement);
        this.controls.zoomToCursor = true;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.2;
        this.controls.maxPolarAngle = Math.PI * 0.5;
        sceneElement.addEventListener('keydown', this.keyHandler);
        this.props.sceneContext.scene.view.setControls(this.controls);

        const targetPos = this.props.sceneContext.scene.view.camera.position.clone();
        targetPos.z = 0;
        this.controls.target = targetPos;
        this.controls.addEventListener('change', this.updateControlsTarget);

        sceneElement.addEventListener('dblclick', this.switchToFirstPersonView);
        this.props.onControlsSet(this);
    }
    componentWillUnmount() {
        this.animationInterrupted = true;
        const sceneElement = this.props.sceneContext.scene.domElement;
        sceneElement.addEventListener('keydown', this.keyHandler);
        this.controls.removeEventListener('change', this.updateControlsTarget);
        this.props.sceneContext.scene.domElement.removeEventListener('dblclick', this.switchToFirstPersonView);
        // Don't explicitly remove controls from the view, they will be removed with the instance
    }
    render() {
        const firstPersonButtonClasses = classNames({
            "map3d-firstperson-button": true,
            "map3d-firstperson-button-active": this.state.firstPerson
        });
        return [(
            <div className="map3d-nav-pan" key="MapPanWidget">
                <span />
                <Icon icon="chevron-up" onMouseDown={(ev) => this.pan(ev, 0, 1)} />
                <span />
                <Icon icon="chevron-left" onMouseDown={(ev) => this.pan(ev, 1, 0)} />
                <Icon icon="home" onClick={() => this.home()} />
                <Icon icon="chevron-right" onMouseDown={(ev) => this.pan(ev, -1, 0)} />
                <span />
                <Icon icon="chevron-down" onMouseDown={(ev) => this.pan(ev, 0, -1)} />
                <span />
            </div>
        ),
        (
            <div className="map3d-nav-rotate" key="MapRotateWidget">
                <span />
                <Icon icon="tilt-up" onMouseDown={(ev) => this.tilt(ev, 0, 1)} />
                <span />
                <Icon icon="tilt-left" onMouseDown={(ev) => this.tilt(ev, 1, 0)} />
                <Icon icon="point" onClick={() => this.resetTilt()} />
                <Icon icon="tilt-right" onMouseDown={(ev) => this.tilt(ev, -1, 0)} />
                <span />
                <Icon icon="tilt-down" onMouseDown={(ev) => this.tilt(ev, 0, -1)} />
                <span />
            </div>
        ), (
            <div className={firstPersonButtonClasses} key="FirstPersonButton" onClick={this.toggleFirstPersonControls}>
                <Icon icon="person" />
            </div>
        )];
    }
    keyHandler = (event) => {
        if (event.repeat) {
            return;
        } else if (event.key === "ArrowUp") {
            if (event.ctrlKey) this.tilt(event, 0, 1, true);
            else this.pan(event, 0, 1, true);
        } else if (event.key === "ArrowDown") {
            if (event.ctrlKey) this.tilt(event, 0, -1, true);
            else this.pan(event, 0, -1, true);
        } else if (event.key === "ArrowLeft") {
            if (event.ctrlKey) this.tilt(event, 1, 0, true);
            else this.pan(event, 1, 0, true);
        } else if (event.key === "ArrowRight") {
            if (event.ctrlKey) this.tilt(event, -1, 0, true);
            else this.pan(event, -1, 0, true);
        } else if (event.key === "PageUp") {
            this.moveCameraHeight(event, +1);
        } else if (event.key === "PageDown") {
            this.moveCameraHeight(event, -1);
        }
    };
    home = () => {
        this.leaveFirstPerson();
        const extent = this.props.sceneContext.map.extent;
        const bounds = [extent.west, extent.south, extent.east, extent.north];
        this.setViewToExtent(bounds);
        this.updateUrlParams();
    };
    pan = (ev, dx, dy, keyboard = false) => {
        // Pan faster the heigher one is above the terrain
        const d = this.state.firstPerson ? (
            200000
        ) : (
            300 + (this.props.sceneContext.scene.view.camera.position.z - this.props.sceneContext.scene.view.controls.target.z) / 250
        );
        const delta = new Vector2(dx, dy).multiplyScalar(d);
        this.animationInterrupted = false;
        let lastTimestamp = new Date() / 1000;
        const animate = () => {
            if (this.animationInterrupted) {
                return;
            }
            // Pan <delta> distance per second
            const timestamp = new Date() / 1000;
            const k = timestamp - lastTimestamp;
            lastTimestamp = timestamp;
            this.props.sceneContext.scene.view.controls._pan(delta.x * k, delta.y * k);
            this.props.sceneContext.scene.notifyChange();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        const element = keyboard ? ev.target : ev.view;
        const event = keyboard ? "keyup" : "mouseup";
        element.addEventListener(event, () => {
            this.animationInterrupted = true;
            this.updateUrlParams();
        }, {once: true});
    };
    tilt = (ev, yaw, az, keyboard = false) => {
        if (this.state.firstPerson) {
            az *= -1;
            yaw *= -1;
        }
        // Pan faster the heigher one is above the terrain
        this.animationInterrupted = false;
        let lastTimestamp = new Date() / 1000;
        const animate = () => {
            if (this.animationInterrupted) {
                return;
            }
            // Pan <delta> distance per second
            const timestamp = new Date() / 1000;
            const k = timestamp - lastTimestamp;
            lastTimestamp = timestamp;
            if (az) {
                this.props.sceneContext.scene.view.controls._rotateUp(az * k);
            }
            if (yaw) {
                this.props.sceneContext.scene.view.controls._rotateLeft(yaw * k);
            }
            this.props.sceneContext.scene.notifyChange();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        const element = keyboard ? ev.target : ev.view;
        const event = keyboard ? "keyup" : "mouseup";
        element.addEventListener(event, () => {
            this.animationInterrupted = true;
            this.updateUrlParams();
        }, {once: true});
    };
    moveCameraHeight = (ev, dir) => {
        if (!this.state.firstPerson) {
            return;
        }
        const pos = this.props.sceneContext.scene.view.camera.position;
        this.props.sceneContext.getTerrainHeightFromDTM([pos.x, pos.y]).then(terrHeight => {
            this.animationInterrupted = false;
            let lastTimestamp = new Date() / 1000;
            const animate = () => {
                if (this.animationInterrupted) {
                    return;
                }
                // Move <delta> distance per second
                const timestamp = new Date() / 1000;
                const k = timestamp - lastTimestamp;
                lastTimestamp = timestamp;
                const z = this.props.sceneContext.scene.view.camera.position.z;
                const delta = 0.5 * (z - terrHeight);
                this.personHeight = Math.max(2, this.personHeight + delta * k * dir);
                const newZ = terrHeight + this.personHeight;
                this.props.sceneContext.scene.view.camera.position.z = newZ;
                this.props.sceneContext.scene.view.controls.target.z = newZ;
                this.props.sceneContext.scene.notifyChange();
                requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        });
        ev.target.addEventListener("keyup", () => {
            this.animationInterrupted = true;
            this.updateUrlParams();
        }, {once: true});
    };
    resetTilt = () => {
        if (this.state.firstPerson) {
            const target = this.props.sceneContext.scene.view.controls.target;
            const camerapos = this.props.sceneContext.scene.view.camera.position;
            this.props.sceneContext.scene.view.controls.target.set(target.x, target.y, camerapos.z);
        } else {
            // Animate from old to new position
            const target = this.props.sceneContext.scene.view.controls.target;
            const oldPosition = this.props.sceneContext.scene.view.camera.position.clone();
            const oldYaw = this.props.sceneContext.scene.view.controls.getAzimuthalAngle();
            const newPosition = new Vector3(target.x, target.y, target.distanceTo(oldPosition));
            const startTime = new Date() / 1000;

            this.animationInterrupted = false;
            const animate = () => {
                if (!this.props.sceneContext.scene || this.animationInterrupted) {
                    return;
                }
                const duration = 2;
                const elapsed = new Date() / 1000 - startTime;
                const x = elapsed / duration;
                const k =  0.5 * (1 - Math.cos(x * Math.PI));

                const currentPosition = new Vector3().lerpVectors(oldPosition, newPosition, k);
                currentPosition.x -= target.x;
                currentPosition.y -= target.y;
                currentPosition.applyAxisAngle(new Vector3(0, 0, 1), -oldYaw * k);
                currentPosition.x += target.x;
                currentPosition.y += target.y;
                this.props.sceneContext.scene.view.camera.position.copy(currentPosition);
                this.props.sceneContext.scene.notifyChange();

                if (elapsed < duration) {
                    requestAnimationFrame(animate);
                } else {
                    this.props.sceneContext.scene.view.camera.position.copy(newPosition);
                    this.props.sceneContext.scene.notifyChange();
                }
            };
            requestAnimationFrame(animate);
        }
        this.updateUrlParams();
    };
    setViewToExtent = (bounds, angle = 0) => {
        if (this.state.firstPerson) {
            this.leaveFirstPerson();
        }

        const center = {
            x: 0.5 * (bounds[0] + bounds[2]),
            y: 0.5 * (bounds[1] + bounds[3])
        };
        center.z = this.props.sceneContext.getTerrainHeightFromMap([center.x, center.y]) ?? 0;

        // Camera height to width bbox width
        const fov = 35 / 180 * Math.PI;
        const cameraHeight = (bounds[2] - bounds[0]) / (2 * Math.tan(fov / 2));

        // Animate from old to new position/target
        const oldPosition = this.props.sceneContext.scene.view.camera.position.clone();
        const oldTarget = this.props.sceneContext.scene.view.controls.target.clone();
        const oldYaw = this.props.sceneContext.scene.view.controls.getAzimuthalAngle();
        const newPosition = new Vector3(center.x, center.y, center.z + cameraHeight);
        const newTarget = new Vector3(center.x, center.y, center.z);
        let rotateAngle = -oldYaw + angle;
        while (rotateAngle > Math.PI) {
            rotateAngle -= 2 * Math.PI;
        }
        while (rotateAngle < -Math.PI) {
            rotateAngle += 2 * Math.PI;
        }
        const startTime = new Date() / 1000;

        this.animationInterrupted = false;
        const animate = () => {
            if (!this.props.sceneContext.scene || this.animationInterrupted) {
                return;
            }
            const duration = 2;
            const elapsed = new Date() / 1000 - startTime;
            const x = elapsed / duration;
            const k =  0.5 * (1 - Math.cos(x * Math.PI));

            const currentPosition = new Vector3().lerpVectors(oldPosition, newPosition, k);
            const currentTarget = new Vector3().lerpVectors(oldTarget, newTarget, k);
            currentPosition.x -= currentTarget.x;
            currentPosition.y -= currentTarget.y;
            currentPosition.applyAxisAngle(new Vector3(0, 0, 1), rotateAngle * k);
            currentPosition.x += currentTarget.x;
            currentPosition.y += currentTarget.y;
            this.props.sceneContext.scene.view.camera.position.copy(currentPosition);
            this.props.sceneContext.scene.view.controls.target.copy(currentTarget);
            this.props.sceneContext.scene.notifyChange();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.props.sceneContext.scene.view.camera.position.copy(newPosition);
                this.props.sceneContext.scene.view.controls.target.copy(newTarget);
                this.props.sceneContext.scene.view.controls._rotateLeft(-angle);
                this.props.sceneContext.scene.notifyChange();
            }
        };
        requestAnimationFrame(animate);
    };
    updateControlsTarget = () => {
        const controls = this.props.sceneContext.scene.view.controls;
        const camera = this.props.sceneContext.scene.view.camera;
        const target = controls.target;
        const raycaster = new Raycaster();
        // Query highest resolution terrain tile (i.e. tile with no children)
        const x = target.x;
        const y = target.y;
        raycaster.set(new Vector3(x, y, target.z + 100000), new Vector3(0, 0, -1));
        const terrInter = raycaster.intersectObjects([this.props.sceneContext.map.object3d]).filter(result => result.object.children.length === 0)[0]?.point;
        // FIXME: Why does raycaster.intersectObjects on terrain return 0-ish even when above terrain?
        if ((terrInter?.z ?? 0) <= 1) {
            return;
        }

        if (this.state.firstPerson) {
            const delta = (terrInter.z + this.personHeight) - camera.position.z;
            camera.position.z += delta;
            target.z += delta;
        } else {
            const cameraHeight = camera.position.z;
            // If camera height is at terrain height, target height should be at terrain height
            // If camera height is at twice the terrain height or further, target height should be zero
            const k = Math.max(0, 1 - (cameraHeight - terrInter.z) / terrInter.z);
            target.lerpVectors(new Vector3(x, y, 0), terrInter, k);
        }
        this.props.setCenter([target.x, target.y, target.z]);
        this.updateUrlParams();
    };
    stopAnimations = () => {
        this.animationInterrupted = true;
    };
    switchToFirstPersonView = (ev) => {
        // Don't do anything if a task is set, may interfere
        if (this.props.currentTask) {
            return;
        }
        if (!this.state.firstPerson) {
            this.setupFirstPerson(ev);
        }
    };
    toggleFirstPersonControls = () => {
        if (this.state.firstPerson) {
            this.leaveFirstPerson();
        } else {
            this.props.sceneContext.scene.domElement.addEventListener('click', this.setupFirstPerson, {once: true});
            const cursor = ConfigUtils.getAssetsPath() + "/img/person.svg";
            this.props.sceneContext.scene.domElement.style.cursor = `url(${cursor}), pointer`;
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
        this.personHeight = 2;
        this.props.sceneContext.getTerrainHeightFromDTM([pos.x, pos.y]).then(z => {
            // Animate from old to new position/target
            const oldPosition = this.props.sceneContext.scene.view.camera.position.clone();
            const oldTarget = this.props.sceneContext.scene.view.controls.target.clone();
            const newPosition = new Vector3(pos.x, pos.y, z + this.personHeight);
            const newTarget = new Vector3(pos.x, pos.y + 300, z + this.personHeight);
            const startTime = new Date() / 1000;

            this.animationInterrupted = false;
            const animate = () => {
                if (!this.props.sceneContext.scene || this.animationInterrupted) {
                    return;
                }
                const duration = 2;
                const elapsed = new Date() / 1000 - startTime;
                const x = elapsed / duration;
                const k =  0.5 * (1 - Math.cos(x * Math.PI));

                const currentPosition = new Vector3().lerpVectors(oldPosition, newPosition, k);
                const currentTarget = new Vector3().lerpVectors(oldTarget, newTarget, k);
                this.props.sceneContext.scene.view.camera.position.copy(currentPosition);
                this.props.sceneContext.scene.view.controls.target.copy(currentTarget);
                this.props.sceneContext.scene.notifyChange();

                if (elapsed < duration) {
                    requestAnimationFrame(animate);
                } else {
                    this.props.sceneContext.scene.view.camera.position.copy(newPosition);
                    this.props.sceneContext.scene.view.controls.target.set(pos.x, pos.y + 0.1, z + this.personHeight);
                    this.props.sceneContext.scene.notifyChange();

                    this.controls.maxPolarAngle = 0.8 * Math.PI;
                    this.controls.panSpeed = 600;
                    this.controls.enableZoom = false;
                    this.setState({firstPerson: true}, this.updateUrlParams);
                }
            };
            requestAnimationFrame(animate);
        });
    };
    leaveFirstPerson = () => {
        this.controls.maxPolarAngle = Math.PI * 0.5;
        this.controls.panSpeed = 1;
        this.controls.enableZoom = true;

        this.setState({firstPerson: false}, () => {
            const cameraPos = this.props.sceneContext.scene.view.camera.position;
            const bounds = [cameraPos.x - 1000, cameraPos.y - 1000, cameraPos.x + 1000, cameraPos.y + 1000];
            this.setViewToExtent(bounds);
            this.updateUrlParams();
        });
    };
    updateUrlParams = () => {
        const tpos = this.props.sceneContext.scene.view.controls.target;
        const cpos = this.props.sceneContext.scene.view.camera.position;
        UrlParams.updateParams({v3d: [tpos.x, tpos.y, tpos.z, cpos.x, cpos.y, cpos.z, this.state.firstPerson ? this.personHeight : 0].map(v => v.toFixed(1)).join(",")});
    };
    restoreView = (viewState) => {
        if (viewState.cameraPos && viewState.center) {
            const cameraPos = this.props.sceneContext.scene.view.camera.position;
            cameraPos.x = viewState.cameraPos[0];
            cameraPos.y = viewState.cameraPos[1];
            cameraPos.z = viewState.cameraPos[2];
            const controlsTarget = this.props.sceneContext.scene.view.controls.target;
            controlsTarget.x = viewState.center[0];
            controlsTarget.y = viewState.center[1];
            controlsTarget.z = viewState.center[2];
            this.personHeight = viewState.personHeight;
            if (this.personHeight > 0) {
                this.controls.maxPolarAngle = 0.8 * Math.PI;
                this.controls.panSpeed = 600;
                this.controls.enableZoom = false;
                this.setState({firstPerson: true});
            }
            this.props.sceneContext.scene.notifyChange();
        }
    };
}

export default connect((state) => ({
    currentTask: state.task.id
}), {
    setCenter: setCenter

})(MapControls3D);

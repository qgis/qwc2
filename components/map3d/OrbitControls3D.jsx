/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import Coordinates from '@giro3d/giro3d/core/geographic/Coordinates';
import PropTypes from 'prop-types';
import {Vector2, Vector3} from 'three';
import {MapControls} from 'three/addons/controls/MapControls';

import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';

import './style/OrbitControls3D.css';


export default class OrbitControls3D extends React.Component {
    static propTypes = {
        mapBBox: PropTypes.object,
        sceneContext: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.animationInterrupted = false;
    }
    componentDidMount() {
        this.controls = new MapControls(this.props.sceneContext.scene.view.camera, this.props.sceneContext.scene.domElement);
        this.controls.zoomToCursor = true;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.2;
        this.controls.maxPolarAngle = Math.PI * 0.5;
        this.props.sceneContext.scene.view.setControls(this.controls);

        const targetPos = this.props.sceneContext.scene.view.camera.position.clone();
        targetPos.z = 0;
        this.controls.target = targetPos;
        this.controls.addEventListener('change', this.updateControlsTarget);
    }
    componentWillUnmount() {
        this.controls.removeEventListener('change', this.updateControlsTarget);
        this.props.sceneContext.scene.view.setControls(null);
        this.controls.dispose();
        this.controls = null;
    }
    render() {
        return [(
            <div className="map3d-nav-pan" key="OrbitPanWidget">
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
            <div className="map3d-nav-rotate" key="OrbitRotateWidget">
                <span />
                <Icon icon="tilt-up" onMouseDown={(ev) => this.tilt(ev, 0, 1)} />
                <span />
                <Icon icon="tilt-left" onMouseDown={(ev) => this.tilt(ev, -1, 0)} />
                <Icon icon="point" onClick={() => this.setViewTopDown()} />
                <Icon icon="tilt-right" onMouseDown={(ev) => this.tilt(ev, 1, 0)} />
                <span />
                <Icon icon="tilt-down" onMouseDown={(ev) => this.tilt(ev, 0, -1)} />
                <span />
            </div>
        )];
    }
    home = () => {
        const extent = this.props.sceneContext.map.extent;
        const bounds = [extent.west, extent.south, extent.east, extent.north];
        this.setViewToExtent(bounds);
    };
    pan = (ev, dx, dy) => {
        MiscUtils.killEvent(ev);
        // Pan faster the heigher one is above the terrain
        const d = (100 + (this.props.sceneContext.scene.view.camera.position.z - this.props.sceneContext.scene.view.controls.target.z) / 250);
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
            this.props.sceneContext.scene.view.controls.update();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        ev.view.addEventListener("mouseup", () => {
            this.animationInterrupted = true;
        }, {once: true});
    };
    setViewTopDown = () => {
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
            this.props.sceneContext.scene.view.controls.update();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.props.sceneContext.scene.view.camera.position.copy(newPosition);
                this.props.sceneContext.scene.view.controls.update();
            }
        };
        requestAnimationFrame(animate);
    };
    tilt = (ev, yaw, az) => {
        MiscUtils.killEvent(ev);
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
            this.props.sceneContext.scene.view.controls.update();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        ev.view.addEventListener("mouseup", () => {
            this.animationInterrupted = true;
        }, {once: true});
    };
    setViewToExtent = (bounds, angle = 0) => {
        const center = {
            x: 0.5 * (bounds[0] + bounds[2]),
            y: 0.5 * (bounds[1] + bounds[3])
        };
        const elevationResult = this.props.sceneContext.map.getElevation({coordinates: new Coordinates(this.props.sceneContext.mapCrs, center.x, center.y)});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        center.z = elevationResult.samples[0]?.elevation || 0;

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
            this.props.sceneContext.scene.view.controls.update();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.props.sceneContext.scene.view.camera.position.copy(newPosition);
                this.props.sceneContext.scene.view.controls.target.copy(newTarget);
                this.props.sceneContext.scene.view.controls._rotateLeft(-angle);
                this.props.sceneContext.scene.view.controls.update();
            }
        };
        requestAnimationFrame(animate);
    };
    updateControlsTarget = () => {
        const x = this.props.sceneContext.scene.view.camera.position.x;
        const y = this.props.sceneContext.scene.view.camera.position.y;
        const elevationResult = this.props.sceneContext.map.getElevation({coordinates: new Coordinates(this.props.sceneContext.mapCrs, x, y)});
        elevationResult.samples.sort((a, b) => a.resolution > b.resolution);
        const terrainHeight = elevationResult.samples[0]?.elevation || 0;
        const cameraHeight = this.props.sceneContext.scene.view.camera.position.z;
        // If camera height is at terrain height, target height should be at terrain height
        // If camera height is at twice the terrain height or further, target height should be zero
        const targetHeight = terrainHeight > 0 ? terrainHeight * Math.max(0, 1 - (cameraHeight - terrainHeight) / terrainHeight) : 0;
        this.props.sceneContext.scene.view.controls.target.z = targetHeight;
    };
    stopAnimations = () => {
        this.animationInterrupted = true;
    };
}

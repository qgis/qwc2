/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Vector3} from 'three';
import {MapControls} from 'three/addons/controls/MapControls';
import {v4 as uuidv4} from 'uuid';


export default class OrbitControls3D extends MapControls {
    constructor(object) {
        super(object);
        this.animationId = null;
        this.sceneContext = null;

        this.enabled = false;
        this.zoomToCursor = true;
        this.enableDamping = true;
        this.dampingFactor = 0.2;
        this.keyPanSpeed = 10.0;
        this.maxPolarAngle = Math.PI * 0.5;

        this._targetHeight = 0;
        this._heightOffset = 0;
        this._keyState = {PageUp: false, PageDown: false};
        this._keyboardNavInterval = null;
    }
    connect(sceneContext) {
        this.domElement = sceneContext.scene.domElement;
        this.sceneContext = sceneContext;
        this.enabled = true;
        super.connect();
        this.listenToKeyEvents(this.domElement);
        this.domElement.addEventListener('pointerdown', this.stopAnimations);
        this.domElement.addEventListener('wheel', this.stopAnimations);
        this.domElement.addEventListener('keydown', this._onKeyDown);
        this.domElement.addEventListener('keyup', this._onKeyUp);
        this.domElement.addEventListener('blur', this._onBlur);
        this.addEventListener('change', this.updateControlsTarget);
        this.object.near = 2;
        this.sceneContext.scene.view.setControls(this);
    }
    disconnect() {
        this.animationId = null;
        super.disconnect();
        this.enabled = false;
        this.sceneContext.scene.view.setControls(null);
        this.domElement.removeEventListener('pointerdown', this.stopAnimations);
        this.domElement.removeEventListener('wheel', this.stopAnimations);
        this.domElement.removeEventListener('keydown', this._onKeyDown);
        this.domElement.removeEventListener('keyup', this._onKeyUp);
        this.domElement.removeEventListener('blur', this._onBlur);
        this.removeEventListener('change', this.updateControlsTarget);
        this._keyState = {PageUp: false, PageDown: false};
    }
    updateControlsTarget = () => {
        if (this.animationId) {
            // Do nothing if animating
            return;
        }
        const camerapos = this.object.position;
        const x = this.target.x;
        const y = this.target.y;

        const height = this.sceneContext.getTerrainHeightFromMap([x, y]) ?? 0;
        // If camera height is at terrain height, target height should be at terrain height
        // If camera height is at twice the terrain height or further, target height should be zero
        this._targetTerrainHeight = Math.max(0, 1 - (camerapos.z - height) / height) * height;
        this.target.z = this._targetTerrainHeight + this._heightOffset;
    };
    setView(camerapos, target) {
        this.object.position.copy(camerapos);
        this.target.copy(target);
        this.updateTargetTerrainAndOffsetHeight(camerapos, target);
        this.update();
    }
    updateTargetTerrainAndOffsetHeight = (camerapos, target) => {
        // Compute targetHeight and heightOffset offset
        const height = this.sceneContext.getTerrainHeightFromMap([target.x, target.y]) ?? 0;
        // If camera height is at terrain height, target height should be at terrain height
        // If camera height is at twice the terrain height or further, target height should be zero
        this._targetTerrainHeight = Math.max(0, 1 - (camerapos.z - height) / height) * height;
        this._heightOffset = target.z - this._targetTerrainHeight;
    };
    panView(dx, dy) {
        if (dx || dy) {
            this._pan(-dx * 10, dy * 10);
            this.update();
        }
    }
    tiltView(azimuth, polar) {
        if (azimuth) {
            this._rotateLeft(azimuth);
        }
        if (polar) {
            this._rotateUp(polar);
        }
        if (azimuth || polar) {
            this.update();
        }
    }
    zoomView(delta) {
        if (delta > 0) {
            this._dollyIn(this._getZoomScale(-delta));
            this.update();
        } else if (delta < 0) {
            this._dollyOut(this._getZoomScale(-delta));
            this.update();
        }
    }
    animateTo(camerapos, target, azimuth, callback = null) {
        const oldPosition = this.object.position.clone();
        const oldTarget = this.target.clone();
        const oldYaw = this.getAzimuthalAngle();
        const newPosition = camerapos;
        const newTarget = target;
        let rotateAngle = -oldYaw + azimuth;
        while (rotateAngle > Math.PI) rotateAngle -= 2 * Math.PI;
        while (rotateAngle < -Math.PI) rotateAngle += 2 * Math.PI;
        const startTime = new Date() / 1000;

        const animationId = uuidv4();
        this.animationId = animationId;
        this.enableDamping = false;
        const animate = () => {
            if (this.animationId !== animationId) {
                this.updateTargetTerrainAndOffsetHeight(this.object.position, this.target);
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
            this.object.position.copy(currentPosition);
            this.target.copy(currentTarget);
            this.update();

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.object.position.copy(newPosition);
                this.target.copy(newTarget);
                this.update();
                this._rotateLeft(this.getAzimuthalAngle() - azimuth);
                this.update();
                this.enableDamping = true;
                this.animationId = null;
                this.updateTargetTerrainAndOffsetHeight(this.object.position, this.target);
                callback?.();
            }
        };
        requestAnimationFrame(animate);
    }
    stopAnimations = () => {
        this.animationId = null;
    };
    _handleKeyboardNav = () => {
        const pg = -this._keyState.PageDown + this._keyState.PageUp;
        if (pg) {
            const newHeightOffset = Math.max(0, this._heightOffset + this._heightOffset * pg * 0.05);
            const deltaHeight = newHeightOffset - this._heightOffset;
            this._heightOffset = newHeightOffset;
            this.target.z = this._targetTerrainHeight + this._heightOffset;
            this.object.position.z += deltaHeight;
            this.update();
        }
    };
    _onKeyDown = (event) => {
        if (event.key in this._keyState) {
            this._keyState[event.key] = true;
            if (!this._keyboardNavInterval) {
                this._keyboardNavInterval = setInterval(this._handleKeyboardNav, 50);
            }
        }
    };
    _onKeyUp = (event) => {
        if (event.key in this._keyState) {
            this._keyState[event.key] = false;
            if (Object.values(this._keyState).every(x => !x)) {
                clearInterval(this._keyboardNavInterval);
                this._keyboardNavInterval = null;
            }
        }
    };
    _onBlur = () => {
        this._keyState = {PageUp: false, PageDown: false};
        clearInterval(this._keyboardNavInterval);
        this._keyboardNavInterval = null;
    };
}

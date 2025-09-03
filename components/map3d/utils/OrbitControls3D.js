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
    constructor(object, mouseButtons) {
        super(object);
        this.animationId = null;
        this.sceneContext = null;

        this.enabled = false;
        this.zoomToCursor = true;
        this.enableDamping = true;
        this.dampingFactor = 0.2;
        this.keyPanSpeed = 10.0;
        this.maxPolarAngle = Math.PI * 0.5;
        this.mouseButtons = mouseButtons;
        this.zoomSpeed = 5;
    }
    connect(sceneContext) {
        this.domElement = sceneContext.scene.domElement;
        this.sceneContext = sceneContext;
        this.enabled = true;
        super.connect();
        this.listenToKeyEvents(this.domElement);
        this.domElement.addEventListener('pointerdown', this.stopAnimations);
        this.domElement.addEventListener('wheel', this.stopAnimations);
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
        this.removeEventListener('change', this.updateControlsTarget);
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
        const newHeight = Math.max(0, 1 - (camerapos.z - height) / height) * height;
        this.target.z = newHeight;
    };
    setView(camerapos, target) {
        this.object.position.copy(camerapos);
        this.target.copy(target);
        this.update();
    }
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
                callback?.();
            }
        };
        requestAnimationFrame(animate);
    }
    stopAnimations = () => {
        this.animationId = null;
    };
}

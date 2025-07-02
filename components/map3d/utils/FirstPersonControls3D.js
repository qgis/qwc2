import {Controls, Raycaster, Vector2, Vector3} from 'three';

const _twoPI = 2 * Math.PI;

const STATE = {
    NONE: - 1,
    ROTATE: 0,
    PAN: 1,
    TOUCH_ROTATE: 2,
    TOUCH_PAN: 3
};

export default class FirstPersonControls3D extends Controls {
    constructor( object, domElement = null ) {
        super( object, domElement );

        // Step sizes
        this.keyPanStep = 1.5;
        this.keyRotateStep = 2 / 180 * Math.PI;
        this.mousePanSpeed = 0.1;
        this.mouseRotateSpeed = 10 / 180 * Math.PI;
        this.personHeight = 3;

        this.sceneContext = null;
        this.enabled = false;
        this.yaw = 0;
        this.pitch = 0;
        this.lookAt = new Vector3(0, 1, 0);
        // Target is the actual collision detection point
        this.target = new Vector3().addVectors(this.object.position, this.lookAt.clone().multiplyScalar(3));
        this.isFirstPerson = true;

        // Internals
        this._keyState = {
            ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
            PageUp: false, PageDown: false,
            Control: false, Shift: false
        };
        this._keyboardNavInterval = null;
        this._changed = false;

        this._interactionState = STATE.NONE;
        this._interactionStart = new Vector2();

        this._pointers = [];
        this._pointerPositions = {};
    }
    connect(sceneContext) {
        this.domElement = sceneContext.scene.domElement;
        this.sceneContext = sceneContext;

        this.domElement.addEventListener('pointerdown', this._onPointerDown);
        this.domElement.addEventListener('pointercancel', this._onPointerUp);
        this.domElement.addEventListener('contextmenu', this._onContextMenu);
        this.domElement.addEventListener('keydown', this._onKeyDown);
        this.domElement.addEventListener('keyup', this._onKeyUp);
        this.domElement.addEventListener('blur', this._onBlur);
        this.domElement.style.touchAction = 'none'; // disable touch scroll

        this.object.near = 0.1;
        this.sceneContext.scene.view.setControls(this);
        this.enabled = true;
    }
    disconnect() {
        this.enabled = false;
        this.sceneContext.scene.view.setControls(null);

        this.domElement.removeEventListener('pointerdown', this._onPointerDown);
        this.domElement.removeEventListener('pointermove', this._onPointerMove);
        this.domElement.removeEventListener('pointerup', this._onPointerUp);
        this.domElement.removeEventListener('pointercancel', this._onPointerUp);

        this.domElement.removeEventListener('contextmenu', this._onContextMenu);

        this.domElement.removeEventListener('keydown', this._onKeyDown);
        this.domElement.removeEventListener('keyup', this._onKeyUp);
        this.domElement.removeEventListener('blur', this._onBlur);

        this.domElement.style.touchAction = 'auto';
    }
    setView(targetpos, lookAt, personHeight = undefined) {
        this.personHeight = personHeight ?? this.personHeight;
        this.target.copy(targetpos);
        this.lookAt.copy(lookAt);
        this.object.position.subVectors(targetpos, lookAt.clone().multiplyScalar(3));
        this.pitch = Math.asin(Math.max(-1.0, Math.min(1.0, this.lookAt.z)));
        this.yaw = Math.atan2(-this.lookAt.x, this.lookAt.y);
        this.object.lookAt(this.target);
        this.dispatchEvent({type: 'change'});
    }
    panView(dx, dy) {
        if (dx || dy) {
            this._pan(dx, dy);
        }
    }
    tiltView(yaw, pitch) {
        this.yaw += yaw;
        this.pitch += pitch;
        if (yaw || pitch) {
            this._changed = true;
            this.update();
        }
    }
    dispose() {
        this.disconnect();
    }
    update( deltaTime = null ) {
        if (!this._changed) {
            return;
        }
        this.lookAt.x = (-Math.sin(this.yaw) * Math.cos(this.pitch));
        this.lookAt.y = (Math.cos(this.yaw) * Math.cos(this.pitch));
        this.lookAt.z = Math.sin(this.pitch);
        this.object.position.subVectors(this.target, this.lookAt.clone().multiplyScalar(3));
        this.object.lookAt(this.target);
        this.dispatchEvent({type: 'change'});
        this._changed = false;
    }
    // Internals
    _rotate( yaw, pitch ) {
        this.yaw += yaw;
        this.pitch = Math.max(-0.5 * Math.PI, Math.min(this.pitch + pitch, 0.5 * Math.PI));
        this._changed = true;
        this.update();
    }
    // deltaX and deltaY are in pixels; right and down are positive
    _pan( deltaX, deltaY ) {
        const cosY = Math.cos(this.yaw);
        const sinY = Math.sin(this.yaw);
        const dx = (cosY * deltaX + -sinY * deltaY);
        const dy = (sinY * deltaX + cosY * deltaY);
        const dir = new Vector2(dx, dy);
        let step = dir.length();
        if (step < 0.001) {
            return;
        }
        dir.divideScalar(step);

        // Adjust step to avoid passing within any wall buffer zone
        const raycaster = new Raycaster();
        raycaster.set(this.target, new Vector3(dir.x, dir.y, 0));
        const inter = raycaster.intersectObjects(this.sceneContext.collisionObjects, true)[0];
        const wallBuffer = 0.5;

        if (inter && (inter.distance - wallBuffer) < step) {
            const overstep = step - (inter.distance - wallBuffer);
            step -= overstep;
            this.target.x += step * dir.x;
            this.target.y += step * dir.y;

            // Project overstep onto wall
            const tangent = new Vector2(-inter.normal.y, inter.normal.x).normalize();
            let slidestep = tangent.dot(dir) * overstep;
            if (slidestep < 0) {
                tangent.negate();
                slidestep *= -1;
            }
            raycaster.set(this.target, new Vector3(tangent.x, tangent.y, 0));
            const slideInter = raycaster.intersectObjects(this.sceneContext.collisionObjects, true)[0];
            if (slideInter && (slideInter.distance - wallBuffer) < slidestep) {
                slidestep = slideInter.distance - wallBuffer;
            }
            this.target.x += slidestep * tangent.x;
            this.target.y += slidestep * tangent.y;
        } else {
            this.target.x += step * dir.x;
            this.target.y += step * dir.y;
        }

        // Stay above terrain // objects on terain
        let height = null;
        raycaster.set(this.target, new Vector3(0, 0, -1));
        const vinter = raycaster.intersectObjects(this.sceneContext.collisionObjects, true)[0];
        if (vinter) {
            height = vinter.point.z;
        } else {
            height = this.sceneContext.getTerrainHeightFromMap([
                this.target.x, this.target.y
            ]);
        }
        if (height) {
            const newHeight = height + this.personHeight;
            this.target.z = 0.75 * this.target.z + 0.25 * newHeight;
        }

        this._changed = true;
        this.update();
    }
    // Keyboard navigate
    _handleKeyboardNav = () => {
        const lr = -this._keyState.ArrowLeft + this._keyState.ArrowRight;
        const du = -this._keyState.ArrowDown + this._keyState.ArrowUp;
        const pg = -this._keyState.PageDown + this._keyState.PageUp;
        const pitch = this._keyState.Shift ? du * this.keyRotateStep : 0;
        const yaw = this._keyState.Control ? 0 : -lr * this.keyRotateStep;
        const dx = this._keyState.Control ? lr * this.keyPanStep * 0.75 : 0;
        const dy = this._keyState.Shift ? 0 : du * this.keyPanStep;
        this._rotate(yaw, pitch);
        this._pan(dx, dy);
        if (pg) {
            const newPersonHeight = Math.max(2, this.personHeight + this.personHeight * pg * 0.05);
            this.target.z += newPersonHeight - this.personHeight;
            this.personHeight = newPersonHeight;
            this._changed = true;
            this.update();
        }
    };
    // Touch pointer tracking
    _addPointer(event) {
        this._pointers.push(event.pointerId);
        this._pointerPositions[event.pointerId] = new Vector2(event.pageX, event.pageY);
    }
    _removePointer(event) {
        delete this._pointerPositions[event.pointerId];
        this._pointers = this._pointers.filter(id => id !== event.pointerId);
    }
    _isTrackingPointer(event) {
        return this._pointers.find(id => id === event.pointerId) !== undefined;
    }
    _trackPointer(event) {
        this._pointerPositions[event.pointerId].set(event.pageX, event.pageY);
    }
    _getTwoPointerPosition(event) {
        const otherPointerId = (event.pointerId === this._pointers[0]) ? this._pointers[1] : this._pointers[0];
        const otherPointerPos = this._pointerPositions[otherPointerId];
        return {x: 0.5 * (event.pageX + otherPointerPos.x), y: 0.5 * (event.pageY + otherPointerPos.y)};
    }
    // Event listeners
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
        this._keyState = {ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, PageUp: false, PageDown: false, Control: false, Shift: false};
        clearInterval(this._keyboardNavInterval);
        this._keyboardNavInterval = null;
    };
    _onPointerDown = (event) => {
        if (!this.enabled) {
            return;
        }
        if (this._pointers.length === 0) {
            this.domElement.setPointerCapture(event.pointerId);
            this.domElement.addEventListener('pointermove', this._onPointerMove);
            this.domElement.addEventListener('pointerup', this._onPointerUp);
            this.domElement.addEventListener('pointercancel', this._onPointerUp);
        } else if (this._isTrackingPointer(event)) {
            return;
        }

        this._addPointer(event);

        if (event.pointerType === 'touch') {
            this._onTouchStart(event);
        } else {
            this._onMouseDown(event);
        }
    };
    _onPointerMove = (event) => {
        if (event.pointerType === 'touch') {
            this._onTouchMove(event);
        } else {
            this._onMouseMove(event);
        }
    };
    _onPointerUp = (event) => {
        this._removePointer(event);

        if (this._pointers.length === 0) {
            this.domElement.releasePointerCapture(event.pointerId);
            this.domElement.removeEventListener('pointermove', this._onPointerMove);
            this.domElement.removeEventListener('pointerup', this._onPointerUp);
            this.domElement.removeEventListener('pointercancel', this._onPointerUp);

            this._interactionState = STATE.NONE;
        } else if (this._pointers.length === 1) {
            const pointerId = this._pointers[0];
            const position = this._pointerPositions[pointerId];

            // minimal placeholder event - allows state correction on pointer-up
            this._onTouchStart({pointerId: pointerId, pageX: position.x, pageY: position.y});
        }
    };
    _onMouseDown = (event) => {
        this._interactionState = STATE.NONE;
        if (event.button === 2) { // Rotate
            this._interactionState = STATE.ROTATE;
            this._interactionStart.set(event.clientX, event.clientY);
        } else if (event.button === 0) { // Pan
            this._interactionState = STATE.PAN;
            this._interactionStart.set(event.clientX, event.clientY);
        }
    };
    _onMouseMove = (event) => {
        const deltaX = event.clientX - this._interactionStart.x;
        const deltaY = event.clientY - this._interactionStart.y;
        this._interactionStart.set(event.clientX, event.clientY);
        if (this._interactionState === STATE.PAN) {
            this._pan(-deltaX * this.mousePanSpeed, deltaY * this.mousePanSpeed);
        } else if (this._interactionState === STATE.ROTATE) {
            this._rotate(
                _twoPI * deltaX * this.mouseRotateSpeed / this.domElement.clientHeight, // yes, height
                _twoPI * deltaY * this.mouseRotateSpeed / this.domElement.clientHeight
            );
        }
    };
    _onTouchStart = (event) => {
        this._interactionState = STATE.NONE;
        if (this._pointers.length === 1) {
            this._interactionState = STATE.TOUCH_PAN;
            this._interactionStart.set(event.pageX, event.pageY);
        } else if (this._pointers.length === 2) {
            this._interactionState = STATE.TOUCH_ROTATE;
            const {x, y} = this._getTwoPointerPosition(event);
            this._interactionStart.set(x, y);
        }
    };
    _onTouchMove = (event) => {
        this._trackPointer(event);
        if (this._interactionState === STATE.TOUCH_PAN) {
            const deltaX = event.pageX - this._interactionStart.x;
            const deltaY = event.pageY - this._interactionStart.y;
            this._interactionStart.set(event.pageX, event.pageY);
            this._pan(-deltaX * this.mousePanSpeed, deltaY * this.mousePanSpeed);
        } else if (this._interactionState === STATE.TOUCH_ROTATE) {
            const {x, y} = this._getTwoPointerPosition(event);
            const deltaX = x - this._interactionStart.x;
            const deltaY = y - this._interactionStart.y;
            this._interactionStart.set(x, y);
            this._rotate(
                _twoPI * deltaX * this.mouseRotateSpeed / this.domElement.clientHeight, // yes, height
                _twoPI * deltaY * this.mouseRotateSpeed / this.domElement.clientHeight
            );
        }
    };
    _onContextMenu = (event) => {
        event.preventDefault();
    };
}

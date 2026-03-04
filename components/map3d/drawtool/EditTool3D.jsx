/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';
import {Color, Group, Raycaster, Vector3} from 'three';
import {CSG} from 'three-csg-ts';
import {TransformControls} from 'three/addons/controls/TransformControls';

import LocaleUtils from '../../../utils/LocaleUtils';
import Icon from '../../Icon';
import {BottomToolPortalContext} from '../../PluginsContainer';
import ButtonBar from '../../widgets/ButtonBar';
import ColorButton from '../../widgets/ColorButton';
import TextInput from '../../widgets/TextInput';
import {updateObjectLabel} from '../utils/MiscUtils3D';
import NumericInput3D from './NumericInput3D';


class GroupSelection extends Group {
    constructor() {
        super();
        this.isGroupSelection = true;
    }
    clone() {
        const clone = super.clone();
        clone.isGroupSelection = true;
        return clone;
    }
    hasObject = (object) => {
        return this.children.indexOf(object) >= 0;
    };
    addToSelection = (object) => {
        this.children.forEach(child => {
            child.position.add(this.position);
        });
        this.add(object);
        object.userData.originalColor = object.material.color.clone();
        object.material.color.set(0xFF0000);
        this.recomputePosition();
    };
    removeFromSelection = (object) => {
        this.parent.attach(object);
        object.material.color.set(object.userData.originalColor);
        delete object.userData.originalColor;
        this.children.forEach(child => {
            child.position.add(this.position);
        });
        this.recomputePosition();
    };
    dissolve = () => {
        if (this.parent === null) {
            // Group has already been removed from scene
            return;
        }
        while (this.children.length) {
            const object = this.children.pop();
            object.material.color.set(object.userData.originalColor);
            delete object.userData.originalColor;
            this.parent.attach(object);
        }
        this.removeFromParent();
    };
    recomputePosition = () => {
        if (this.children.length === 0) {
            this.position.set(0, 0, 0);
        } else {
            const center = new Vector3();
            this.children.forEach(child => {
                center.add(child.position);
            });
            center.divideScalar(this.children.length);
            this.position.copy(center);
            this.children.forEach(child => {
                child.position.sub(this.position);
            });
            this.updateMatrixWorld(true);
        }
    };
}

export default class EditTool3D extends React.Component {
    static contextType = BottomToolPortalContext;
    static propTypes = {
        color: PropTypes.array,
        colorChanged: PropTypes.func,
        drawGroupId: PropTypes.string,
        objectPicked: PropTypes.func,
        sceneContext: PropTypes.object,
        selectedObject: PropTypes.object
    };
    state = {
        mode: 'translate',
        numericInput: false,
        selectCount: 0,
        csgBackup: null,
        label: '',
        snapTo3dEnabled: true
    };
    componentDidMount() {
        const camera = this.props.sceneContext.scene.view.camera;
        const renderer = this.props.sceneContext.scene.renderer;
        this.transformControls = new TransformControls(camera, renderer.domElement);
        this.props.sceneContext.scene.add(this.transformControls.getHelper());
        this.transformControls.setMode(this.state.mode);
        this.transformControls.setSpace('local');
        this.transformControls.setTranslationSnap(1);
        this.transformControls.scaleFromEdge = true;
        this.transformControls.allowNegativeScales = false;
        this.transformControls.setRotationSnap(5 / 180 * Math.PI);
        this.transformControls.addEventListener('mouseDown', this.onControlMouseDown);
        this.transformControls.addEventListener('objectChange', this.onControlObjectChange);
        this.transformControls.addEventListener('change', this.onControlChange);
        this.transformControls.addEventListener('mouseUp', this.onControlMouseUp);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.props.sceneContext.scene.view.controls.enabled = !event.value;
        });
        renderer.domElement.addEventListener("pointerdown", this.selectShapeOnRelease);
        renderer.domElement.addEventListener('keydown', this.onKeyDown);
        renderer.domElement.addEventListener('keyup', this.onKeyUp);
        if (this.props.selectedObject) {
            this.transformControls.attach(this.props.selectedObject);
            this.transformControls.getHelper().updateMatrixWorld();
            this.props.colorChanged(this.props.selectedObject.material.color.toArray().map(c => c * 255));
            this.setState({label: this.props.selectedObject.userData?.label || "", selectCount: 1});
        }
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateTransformHelper);
        this.props.sceneContext.scene.notifyChange();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.selectedObject !== prevProps.selectedObject) {
            if (prevProps.selectedObject?.isGroupSelection) {
                prevProps.selectedObject.dissolve();
            }
            if (prevProps.selectedObject) {
                this.transformControls.detach();
                this.clearCsgBackup();
            }
            let selectCount = 0;
            if (this.props.selectedObject) {
                this.transformControls.attach(this.props.selectedObject);
                if (!this.props.selectedObject.isGroupSelection) {
                    selectCount = 1;
                    this.props.colorChanged(this.props.selectedObject.material.color.toArray().map(c => c * 255));
                } else {
                    selectCount = this.props.selectedObject.children.length;
                }
                if (this.props.selectedObject.userData.originalChildren) {
                    this.setState({csgBackup: this.props.selectedObject.userData.originalChildren});
                    delete this.props.selectedObject.userData.originalChildren;
                }
                this.setState({label: this.props.selectedObject.userData?.label || ""});
            }
            this.transformControls.getHelper().updateMatrixWorld();
            this.props.sceneContext.scene.notifyChange();
            this.setState({selectCount});
        }
        if (this.state.mode !== prevState.mode) {
            this.transformControls.setMode(this.state.mode);
            this.transformControls.setSpace('local');
            this.transformControls.getHelper().updateMatrixWorld();
            this.props.sceneContext.scene.notifyChange();
        }
        if (this.props.color !== prevProps.color && this.props.selectedObject) {
            if (!this.props.selectedObject.isGroupSelection) {
                this.props.selectedObject.material.color.setRGB(...this.props.color.map(c => c / 255));
            } else {
                this.props.selectedObject.children.forEach(child => {
                    child.userData.originalColor.setRGB(...this.props.color.map(c => c / 255));
                });
            }
            this.props.sceneContext.scene.notifyChange();
        }
    }
    componentWillUnmount() {
        this.clearCsgBackup();
        this.dissolveSelectionGroup();
        this.transformControls.detach();
        this.props.sceneContext.scene.remove(this.transformControls.getHelper());
        this.transformControls.dispose();
        const domElement = this.props.sceneContext.scene.renderer.domElement;
        this.props.sceneContext.scene.view.controls.removeEventListener('change', this.updateTransformHelper);
        domElement.removeEventListener("pointerdown", this.selectShapeOnRelease);
        domElement.removeEventListener('keydown', this.onKeyDown);
        this.props.sceneContext.scene.notifyChange();
    }
    render() {
        const editButtons = [
            {key: "translate", label: LocaleUtils.tr("draw3d.translate")},
            {key: "scale", label: LocaleUtils.tr("draw3d.scale")},
            {key: "rotate", label: LocaleUtils.tr("draw3d.rotate")}
        ];
        const extraButtons = [
            {key: "clone", tooltip: LocaleUtils.tr("common.clone"), icon: "clone"},
            {key: "NumericInput", tooltip: LocaleUtils.tr("draw3d.numericinput"), icon: "numericinput"}
        ];
        const csgButtons = [
            {key: "union", label: LocaleUtils.tr("draw3d.union")},
            {key: "subtract", label: LocaleUtils.tr("draw3d.subtract")},
            {key: "intersect", label: LocaleUtils.tr("draw3d.intersect")}
        ];
        return [
            (
                <div className="redlining-controlsbar" key="BasicControls">
                    <div className="redlining-control">
                        <Icon className="redlining-control-icon" icon="pen" size="large" />
                        <ColorButton alpha={false} color={this.props.color} onColorChanged={this.props.colorChanged} />
                    </div>
                    <div className="redlining-control">
                        <ButtonBar active={this.state.mode} buttons={editButtons} onClick={mode => this.setState({mode})} />
                    </div>
                    <div className="redlining-control">
                        <ButtonBar active={this.state.numericInput ? "NumericInput" : null} buttons={extraButtons} onClick={this.toolButtonClicked} />
                    </div>
                    {this.state.numericInput ? (
                        <NumericInput3D
                            sceneContext={this.props.sceneContext} selectedObject={this.props.selectedObject}
                            toggleNumericInput={this.toggleNumericInput} transformControls={this.transformControls}
                        />
                    ) : null}
                </div>
            ),
            this.state.selectCount === 0 ? (
                <div className="redlining-message" key="CtrlHint">
                    {LocaleUtils.tr("redlining.ctrlhint")}
                </div>
            ) : null,
            this.state.selectCount === 1 ? (
                <div className="redlining-controlsbar" key="Label">
                    <div className="redlining-control redlining-control-fill controlgroup">
                        <span>{LocaleUtils.tr("draw3d.label")}:&nbsp;</span>
                        <TextInput className="controlgroup-fillitem" onChange={this.setLabel} value={this.state.label} />
                    </div>
                </div>
            ) : null,
            this.state.selectCount === 2 ? (
                <div className="redlining-controlsbar" key="CSGControls">
                    <div className="redlining-control redlining-control-fill">
                        <ButtonBar buttons={csgButtons} onClick={this.applyCsgOperation} />
                    </div>
                </div>
            ) : null,
            this.state.csgBackup ? (
                <div className="redlining-controlsbar" key="CSGControls">
                    <div className="redlining-control redlining-control-fill">
                        <ButtonBar buttons={[{key: "undo", label: LocaleUtils.tr("draw3d.undoBool")}]} onClick={this.undoCsgOperation} />
                    </div>
                </div>
            ) : null,
            ReactDOM.createPortal((
                <div>
                    <button className={"button" + (this.state.snapTo3dEnabled ? " pressed" : "")} onClick={() => this.setState(state => ({snapTo3dEnabled: !state.snapTo3dEnabled}))}>
                        <Icon icon="snap_3d" size="large" />
                    </button>
                </div>
            ), this.context)
        ];
    }
    toolButtonClicked = (key) => {
        if (key === "NumericInput") {
            this.toggleNumericInput();
        } else if (key === "clone") {
            this.cloneSelectedObject();
        }
    };
    selectShapeOnRelease = (ev) => {
        if (ev.button === 0 && !this.transformControls.dragging) {
            const renderer = this.props.sceneContext.scene.renderer;
            renderer.domElement.addEventListener("pointerup", this.selectShape, {once: true});
            renderer.domElement.addEventListener("pointermove", () => {
                renderer.domElement.removeEventListener("pointerup", this.selectShape);
            });
        }
    };
    selectShape = (ev) => {
        const rect = ev.target.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        const intersection = this.props.sceneContext.getSceneIntersection(x, y);
        if (intersection) {
            // Check if closest (first) intersected object is within the current draw group
            const object = intersection.object;
            const drawGroup = this.props.sceneContext.getSceneObject(this.props.drawGroupId);
            for (let parent = object.parent; parent; parent = parent.parent) {
                if (parent === drawGroup) {
                    if (ev.ctrlKey && this.props.selectedObject) {
                        this.addRemoveFromSelection(object);
                    } else {
                        this.dissolveSelectionGroup();
                        this.props.objectPicked(object);
                    }
                    return;
                }
            }
        }
        if (!ev.ctrlKey) {
            this.dissolveSelectionGroup();
            this.props.objectPicked(null);
        }
    };
    addRemoveFromSelection = (object) => {
        if (this.props.selectedObject === object) {
            this.props.objectPicked(null);
        } else if (this.props.selectedObject.isGroupSelection) {
            if (this.props.selectedObject.hasObject(object)) {
                this.props.selectedObject.removeFromSelection(object);
                if (this.props.selectedObject.children.length === 1) {
                    const child = this.props.selectedObject.children[0];
                    this.props.selectedObject.dissolve();
                    this.props.objectPicked(child);
                }
            } else {
                this.props.selectedObject.addToSelection(object);
            }
            this.setState({selectCount: this.props.selectedObject.children.length});
            this.updateTransformHelper();
        } else {
            const groupSelection = new GroupSelection();
            object.parent.add(groupSelection);
            groupSelection.addToSelection(object);
            if (this.props.selectedObject && this.props.selectedObject !== object) {
                groupSelection.addToSelection(this.props.selectedObject);
            }
            this.props.objectPicked(groupSelection);
        }
    };
    dissolveSelectionGroup = () => {
        if (this.props.selectedObject?.isGroupSelection) {
            this.props.selectedObject.dissolve();
        }
    };
    updateTransformHelper = () => {
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange();
    };
    onKeyDown = (ev) => {
        if (ev.key === "Escape") {
            this.transformControls.reset();
        } else if (ev.key === "Control") {
            this.transformControls.enabled = false;
        }
    };
    onKeyUp = (ev) => {
        if (ev.key === "Control") {
            this.transformControls.enabled = true;
        }
    };
    toggleNumericInput = () => {
        this.setState(state => ({numericInput: !state.numericInput}));
    };
    applyCsgOperation = (operation) => {
        let result = null;
        const children = [...this.props.selectedObject.children].reverse();
        if (operation === "union") {
            result = CSG.union(...children);
        } else if (operation === "subtract") {
            result = CSG.subtract(...children);
        } else if (operation === "intersect") {
            result = CSG.intersect(...children);
        }
        if (result) {
            this.props.sceneContext.computeBoundsTree(result);
            const parent = this.props.selectedObject.parent;
            result.position.add(this.props.selectedObject.position);
            this.props.selectedObject.dissolve();
            children[0].removeFromParent();
            children[1].removeFromParent();
            result.material.color = new Color().lerpColors(children[0].material.color, children[1].material.color, 0.5);
            result.userData.originalChildren = children;
            parent.attach(result);
            // Re-center object
            const offset = result.geometry.boundingBox.getCenter(new Vector3());
            offset.applyQuaternion(result.quaternion);
            result.position.add(offset);
            result.geometry.center();
            this.props.objectPicked(result);
        }
    };
    undoCsgOperation = () => {
        const parent = this.props.selectedObject.parent;
        const children = this.state.csgBackup;
        parent.attach(children[0]);
        parent.attach(children[1]);
        this.props.selectedObject.removeFromParent();
        const group = new GroupSelection();
        group.addToSelection(children[0]);
        group.addToSelection(children[1]);
        parent.add(group);
        this.props.objectPicked(group);
    };
    clearCsgBackup = () => {
        this.setState({csgBackup: null});
    };
    setLabel = (text) => {
        this.setState({label: text});
        this.props.selectedObject.userData.label = text;
        updateObjectLabel(this.props.selectedObject, this.props.sceneContext);
        this.props.sceneContext.scene.notifyChange(this.props.selectedObject);
    };
    cloneSelectedObject = () => {
        if (this.props.selectedObject) {
            const clonedObject = this.deepClone(this.props.selectedObject);
            clonedObject.position.x += 10;
            clonedObject.position.y += 10;
            clonedObject.updateMatrixWorld();
            this.props.selectedObject.parent.add(clonedObject);
            this.props.objectPicked(clonedObject);
        }
    };
    deepClone = (object) => {
        const clone = object.clone(false);

        if (object.geometry) {
            clone.geometry = object.geometry.clone();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                clone.material = object.material.map(mat => mat.clone());
            } else {
                clone.material = object.material.clone();
            }
        }
        object.children.forEach(child => {
            clone.add(this.deepClone(child));
        });
        return clone;
    };
    onControlMouseDown = (e) => {
        const {object} = e.target;
        if (object.geometry) {
            if (!object.geometry.boundingBox) {
                object.geometry.computeBoundingBox();
            }
            this._bbox = object.geometry.boundingBox.clone();
            this._scaleStart = object.scale.clone();
            this._positionStart = object.position.clone();
        }
    };
    onControlObjectChange = (e) => {
        const control = e.target;
        const {mode, object} = control;
        if (mode === 'scale') {
            // Block zero or negative scales
            object.scale.max(new Vector3(0.1, 0.1, 0.1));
            const offset = new Vector3();
            if (this._bbox) {
                if (control.pointStart.x > 0) {
                    offset.x = this._bbox.min.x * (this._scaleStart.x - object.scale.x);
                } else {
                    offset.x = this._bbox.max.x * (this._scaleStart.x - object.scale.x);
                }

                if (control.pointStart.y > 0) {
                    offset.y = this._bbox.min.y * (this._scaleStart.y - object.scale.y);
                } else {
                    offset.y = this._bbox.max.y * (this._scaleStart.y - object.scale.y);
                }

                if (control.pointStart.z > 0) {
                    offset.z = this._bbox.min.z * (this._scaleStart.z - object.scale.z);
                } else {
                    offset.z = this._bbox.max.z * (this._scaleStart.z - object.scale.z);
                }
                offset.applyQuaternion(object.quaternion);
                object.position.copy(offset).add(this._positionStart);

                const snapOffset = this.computeSnapOffset(object, control);
                const sx = control.pointStart.x > 0 ? 1 : -1;
                const sy = control.pointStart.y > 0 ? 1 : -1;
                const sz = control.pointStart.z > 0 ? 1 : -1;
                object.scale.x += snapOffset.x / (this._bbox.max.x - this._bbox.min.x) * sx;
                object.scale.y += snapOffset.y / (this._bbox.max.y - this._bbox.min.y) * sy;
                object.scale.z += snapOffset.z / (this._bbox.max.z - this._bbox.min.z) * sz;
                object.position.x += snapOffset.x * 0.5;
                object.position.y += snapOffset.y * 0.5;
                object.position.z += snapOffset.z * 0.5;
            }
        } else if (mode === 'translate') {
            object.position.add(this.computeSnapOffset(object, control));
        }
        object.updateMatrixWorld();
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange(object);
    };
    computeSnapOffset = (object, control) => {
        if (!this.state.snapTo3dEnabled) {
            return new Vector3();
        }
        const axismap = {
            X: new Vector3(1, 0, 0).applyQuaternion(object.quaternion),
            Y: new Vector3(0, 1, 0).applyQuaternion(object.quaternion),
            Z: new Vector3(0, 0, 1).applyQuaternion(object.quaternion)
        };
        object.updateMatrixWorld();
        const snapDistance = 5;
        const positionAttr = object.geometry.attributes.position;
        const positions = [];
        for (let i = 0; i < positionAttr.count; i++) {
            positions.push(new Vector3(
                positionAttr.getX(i),
                positionAttr.getY(i),
                positionAttr.getZ(i)
            ).applyMatrix4(object.matrixWorld));
        }

        const raycaster = new Raycaster();
        raycaster.far = 2 * snapDistance;
        const sceneContext = this.props.sceneContext;
        const inters = [];

        // For each translation axis
        [...control.axis].forEach(axis => {
            const dir = axismap[axis];
            let maxdot = 0;
            let psnappos = [];
            let pavgpos = null;
            let mindot = 0;
            let nsnappos = [];
            let navgpos = null;

            // Collect extremes along each axis
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                const pdir = pos.clone().sub(object.position);
                const dot = pdir.dot(dir);
                if (dot > maxdot) {
                    maxdot = dot;
                    psnappos = [pos];
                    pavgpos = pos.clone();
                } else if (dot !== 0 && dot === maxdot) {
                    psnappos.push(pos);
                    pavgpos.add(pos);
                }
                if (dot < mindot) {
                    mindot = dot;
                    nsnappos = [pos];
                    navgpos = pos.clone();
                } else if (dot !== 0 && dot === mindot) {
                    nsnappos.push(pos);
                    navgpos.add(pos);
                }
            }
            // Also add average point (i.e. center of face)
            if (psnappos.length > 1) {
                psnappos.push(pavgpos.divideScalar(psnappos.length));
            }
            if (nsnappos.length > 1) {
                nsnappos.push(navgpos.divideScalar(nsnappos.length));
            }

            // Ray-cast to check collisions
            const collisionObjects = [...sceneContext.collisionObjects];
            if (axis === "Z") {
                collisionObjects.push(sceneContext.map.object3d);
            }
            const ndir = dir.clone().negate();
            psnappos.concat(nsnappos).forEach(pos => {
                raycaster.set(pos, dir);
                inters.push(raycaster.intersectObjects(collisionObjects, true).filter(
                    intr => intr.object.uuid !== object.uuid && intr.distance < snapDistance
                ).map(intr => ({...intr, snappos: pos}))[0]);
                raycaster.set(pos, ndir);
                inters.push(raycaster.intersectObjects(collisionObjects, true).filter(
                    intr => intr.object.uuid !== object.uuid && intr.distance < snapDistance
                ).map(intr => ({...intr, snappos: pos}))[0]);
            });
        });
        const inter = inters.filter(Boolean).sort((a, b) => a.distance - b.distance)[0];
        return inter ? inter.point.clone().sub(inter.snappos) : new Vector3();
    };
    onControlMouseUp = (e) => {
        this._bbox = null;
        this._scaleStart = null;
        this._positionStart = null;

        const {object} = e.target;
        this.clearCsgBackup();
        object.updateMatrixWorld();
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange(object);
    };
    onControlChange = () => {
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange(this.transformControls.getHelper());
    };
}

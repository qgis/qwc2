/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {Group, Vector3} from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls';

import LocaleUtils from '../../../utils/LocaleUtils';
import Icon from '../../Icon';
import ButtonBar from '../../widgets/ButtonBar';
import ColorButton from '../../widgets/ColorButton';
import NumericInput3D from './NumericInput3D';


class GroupSelection extends Group {
    constructor() {
        super();
        this.isGroupSelection = true;
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
            this.position.copy(center)
            this.updateMatrixWorld();
            this.children.forEach(child => {
                child.position.sub(this.position);
                child.updateMatrixWorld();
            });
        }
    };
}

export default class EditTool3D extends React.Component {
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
        numericInput: false
    };
    componentDidMount() {
        const camera = this.props.sceneContext.scene.view.camera;
        const renderer = this.props.sceneContext.scene.renderer;
        this.transformControls = new TransformControls( camera, renderer.domElement );
        this.props.sceneContext.scene.add(this.transformControls.getHelper());
        this.transformControls.setMode(this.state.mode);
        this.transformControls.addEventListener('change', this.toolChanged);
        this.transformControls.addEventListener('mouseUp', this.toolChanged);
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
        }
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateTransformHelper);
        this.props.sceneContext.scene.notifyChange();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.selectedObject !== prevProps.selectedObject) {
            if (prevProps.selectedObject) {
                this.transformControls.detach();
            }
            if (this.props.selectedObject) {
                this.transformControls.attach(this.props.selectedObject);
                if (!this.props.selectedObject.isGroupSelection) {
                    this.props.colorChanged(this.props.selectedObject.material.color.toArray().map(c => c * 255));
                }
            }
            this.transformControls.getHelper().updateMatrixWorld();
            this.props.sceneContext.scene.notifyChange();
        }
        if (this.state.mode !== prevState.mode) {
            this.transformControls.setMode(this.state.mode);
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
            {key: "NumericInput", tooltip: LocaleUtils.tr("draw3d.numericinput"), icon: "numericinput"}
        ];
        return (
            <div className="redlining-controlsbar">
                <span>
                    <Icon className="redlining-control-icon" icon="pen" size="large" />
                    <ColorButton alpha={false} color={this.props.color} onColorChanged={this.props.colorChanged} />
                </span>
                <span>
                    <ButtonBar active={this.state.mode} buttons={editButtons} onClick={mode => this.setState({mode})} />
                </span>
                <span className="redlining-group">
                    <ButtonBar active={this.state.numericInput ? "NumericInput" : null} buttons={extraButtons} onClick={this.toggleNumericInput} />
                </span>
                {this.state.numericInput ? (
                    <NumericInput3D
                        sceneContext={this.props.sceneContext} selectedObject={this.props.selectedObject}
                        toggleNumericInput={this.toggleNumericInput} transformControls={this.transformControls}
                    />
                ) : null}
            </div>
        );
    }
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
        }
        this.props.objectPicked(null);
    };
    addRemoveFromSelection = (object) => {
        if (this.props.selectedObject.isGroupSelection) {
            if (this.props.selectedObject.hasObject(object)) {
                this.props.selectedObject.removeFromSelection(object);
            } else {
                this.props.selectedObject.addToSelection(object);
            }
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
    toolChanged = () => {
        this.props.selectedObject?.updateMatrixWorld?.();
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
}

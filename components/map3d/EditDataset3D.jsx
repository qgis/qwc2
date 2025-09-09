/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {TransformControls} from 'three/addons/controls/TransformControls';

import LocaleUtils from '../../utils/LocaleUtils';
import TaskBar from '../TaskBar';
import ButtonBar from '../widgets/ButtonBar';
import TextInput from '../widgets/TextInput';
import {updateObjectLabel} from './utils/MiscUtils3D';


class EditDataset3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        taskData: PropTypes.object
    };
    static defaultState = {
        mode: 'translate',
        label: ''
    };
    state = EditDataset3D.defaultState;
    render() {
        return (
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="EditDataset3D">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    renderBody = () => {
        const actionButtons = [
            {key: "zoomto", label: LocaleUtils.tr("editdataset3d.zoomto"), icon: "zoom"},
            {key: "moveobj", label: LocaleUtils.tr("editdataset3d.moveobj"), icon: "move"}
        ];
        const editButtons = [
            {key: "translate", label: LocaleUtils.tr("draw3d.translate")},
            {key: "scale", label: LocaleUtils.tr("draw3d.scale")},
            {key: "rotate", label: LocaleUtils.tr("draw3d.rotate")}
        ];
        return [(
            <div className="redlining-controlsbar" key="Action">
                <div className="redlining-control redlining-control-fill">
                    <ButtonBar buttons={actionButtons} onClick={this.actionClicked} />
                </div>
            </div>
        ), (
            <div className="redlining-controlsbar" key="Mode">
                <div className="redlining-control redlining-control-fill">
                    <ButtonBar active={this.state.mode} buttons={editButtons} onClick={this.setMode} />
                </div>
            </div>
        ), (
            <div className="redlining-controlsbar" key="Label">
                <div className="redlining-control redlining-control-fill controlgroup">
                    <span>{LocaleUtils.tr("draw3d.label")}:&nbsp;</span>
                    <TextInput className="controlgroup-fillitem" onChange={this.setLabel} value={this.state.label} />
                </div>
            </div>
        )];
    };
    onShow = () => {
        let object = this.props.sceneContext.getSceneObject(this.props.taskData.objectId);
        if (object.tiles) {
            object = object.tiles.group.parent;
        }

        // Setup transform control
        const camera = this.props.sceneContext.scene.view.camera;
        const renderer = this.props.sceneContext.scene.renderer;
        this.transformControls = new TransformControls(camera, renderer.domElement);
        this.transformControls.setMode(this.state.mode);
        this.transformControls.setSpace('local');
        this.props.sceneContext.scene.add(this.transformControls.getHelper());
        this.transformControls.attach(object);
        this.transformControls.getHelper().updateMatrixWorld();
        this.transformControls.addEventListener('change', this.toolChanged);
        this.transformControls.addEventListener('mouseUp', this.toolChanged);
        renderer.domElement.addEventListener('keydown', this.onKeyDown);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.props.sceneContext.scene.view.controls.enabled = !event.value;
        });
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateTransformHelper);

        this.props.sceneContext.scene.notifyChange();
    };
    onHide = () => {
        this.transformControls.detach();
        this.props.sceneContext.scene.remove(this.transformControls.getHelper());
        this.transformControls.dispose();
        this.transformControls = null;

        const domElement = this.props.sceneContext.scene.renderer.domElement;
        domElement.removeEventListener('keydown', this.onKeyDown);
        this.props.sceneContext.scene.view.controls.removeEventListener('change', this.updateTransformHelper);

        this.props.sceneContext.scene.notifyChange();
        this.setState(EditDataset3D.defaultState);
    };
    updateTransformHelper = () => {
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange();
    };
    actionClicked = (action) => {
        if (action === "zoomto") {
            this.props.sceneContext.zoomToObject(this.props.taskData.objectId);
        } else if (action === "moveobj") {
            const sceneTarget = this.props.sceneContext.scene.view.controls.target.clone();
            sceneTarget.z = this.props.sceneContext.getTerrainHeightFromMap([
                sceneTarget.x, sceneTarget.y
            ]) ?? 0;
            this.transformControls.object.position.copy(sceneTarget);
            this.transformControls.object.updateMatrix();
            this.props.sceneContext.scene.notifyChange();
        }
    };
    setMode = (mode) => {
        this.setState({mode});
        this.transformControls.setMode(mode);
    };
    setLabel = (label) => {
        this.transformControls.object.userData.label = label;
        updateObjectLabel(this.transformControls.object, this.props.sceneContext);
        this.setState({label});
    };
    toolChanged = () => {
        this.updateMatrixWorld?.();
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange();
    };
    onKeyDown = (ev) => {
        if (ev.key === "Escape") {
            this.transformControls.reset();
        }
    };
}

export default connect((state) => ({
    taskData: state.task.id === "EditDataset3D" ? state.task.data : null
}))(EditDataset3D);

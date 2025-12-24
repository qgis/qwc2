/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {Group} from 'three';
import {v4 as uuidv4} from 'uuid';

import Icon from '../../components/Icon';
import CreateTool3D from '../../components/map3d/drawtool/CreateTool3D';
import EditTool3D from '../../components/map3d/drawtool/EditTool3D';
import TaskBar from '../../components/TaskBar';
import ButtonBar from '../../components/widgets/ButtonBar';
import LocaleUtils from '../../utils/LocaleUtils';


/**
 * Draw objects in the 3D map.
 */
export default class Draw3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        action: null,
        baseSize: 10,
        color: [255, 105,   0, 1],
        geomType: null,
        drawGroupId: "",
        selectedObject: null
    };
    onShow = () => {
        this.ensureDrawGroup();
        this.setState({action: 'Pick'});
    };
    onHide = () => {
        // Remove empty draw groups
        Object.entries(this.props.sceneContext.sceneObjects).filter(([objectId, options]) => {
            return options.drawGroup === true;
        }).forEach(([objectId, options]) => {
            const object = this.props.sceneContext.getSceneObject(objectId);
            if (object.children.length === 0) {
                this.props.sceneContext.removeSceneObject(objectId);
            }
        });
        this.setState({selectedObject: null});
    };
    ensureDrawGroup = () => {
        // Ensure a draw group is present
        const drawGroup = Object.entries(this.props.sceneContext.sceneObjects).find(([key, options]) => {
            return options.drawGroup === true;
        });
        if (drawGroup === undefined) {
            this.addDrawGroup(LocaleUtils.tr("draw3d.drawings"));
        } else {
            this.props.sceneContext.updateSceneObject(drawGroup[0], {visibility: true});
            this.setState({drawGroupId: drawGroup[0]});
        }
    };
    createDrawGroup = () => {
        const message = LocaleUtils.tr("draw3d.newgroupprompt");
        // eslint-disable-next-line
        const name = prompt(message);
        if (name) {
            this.addDrawGroup(name);
        }
    };
    addDrawGroup = (name) => {
        const objectId = uuidv4();
        const options = {
            drawGroup: true,
            layertree: true,
            title: name
        };
        this.props.sceneContext.addSceneObject(objectId, new Group(), options);
        this.setState({drawGroupId: objectId});
    };
    renderBody = () => {
        const activeButton = this.state.action === "Create" ? this.state.geomType : this.state.action;
        const drawButtons = [
            {key: "Cuboid", tooltip: LocaleUtils.tr("draw3d.cuboid"), icon: "cuboid", data: {action: "Create", geomType: "Cuboid"}},
            {key: "Wedge", tooltip: LocaleUtils.tr("draw3d.wedge"), icon: "wedge", data: {action: "Create", geomType: "Wedge"}},
            {key: "Cylinder", tooltip: LocaleUtils.tr("draw3d.cylinder"), icon: "cylinder", data: {action: "Create", geomType: "Cylinder"}},
            [
                {key: "Pyramid", tooltip: LocaleUtils.tr("draw3d.pyramid"), icon: "pyramid", data: {action: "Create", geomType: "Pyramid"}},
                {key: "Sphere", tooltip: LocaleUtils.tr("draw3d.sphere"), icon: "sphere", data: {action: "Create", geomType: "Sphere"}},
                {key: "Cone", tooltip: LocaleUtils.tr("draw3d.cone"), icon: "cone", data: {action: "Create", geomType: "Cone"}}
            ]
        ];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.tr("common.pick"), icon: "nodetool", data: {action: "Pick", geomType: null}},
            {key: "Delete", tooltip: LocaleUtils.tr("common.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.state.selectedObject}
        ];
        const drawGroups = Object.entries(this.props.sceneContext.sceneObjects).filter(([key, entry]) => entry.drawGroup === true);
        return (
            <div>
                <div className="redlining-controlsbar">
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.layer")}</div>
                        <div className="controlgroup">
                            <select onChange={ev => this.setActiveDrawGroup(ev.target.value)} value={this.state.drawGroupId}>
                                {drawGroups.map(([objectId, options]) => (
                                    <option key={objectId} value={objectId}>{options.title}</option>
                                ))}
                            </select>
                            <button className="button" onClick={this.createDrawGroup}><Icon icon="plus" /></button>
                        </div>
                    </div>
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.draw")}</div>
                        <ButtonBar active={activeButton} buttons={drawButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.edit")}</div>
                        <ButtonBar active={activeButton} buttons={editButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                </div>
                {this.renderControl()}
            </div>
        );
    };
    renderControl = () => {
        if (this.state.action === "Create") {
            return (
                <CreateTool3D
                    baseSize={this.state.baseSize} baseSizeChanged={baseSize => this.setState({baseSize})}
                    color={this.state.color} colorChanged={color => this.setState({color})}
                    drawGroupId={this.state.drawGroupId} geomType={this.state.geomType}
                    objectCreated={this.objectCreated} sceneContext={this.props.sceneContext} />
            );
        } else if (this.state.action === "Pick") {
            return (
                <EditTool3D
                    color={this.state.color} colorChanged={color => this.setState({color})}
                    drawGroupId={this.state.drawGroupId} objectPicked={this.objectPicked}
                    sceneContext={this.props.sceneContext}
                    selectedObject={this.state.selectedObject} />
            );
        }
        return null;
    };
    render() {
        return (
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="Draw3D">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    setActiveDrawGroup = (drawGroupId) => {
        this.props.sceneContext.updateSceneObject(drawGroupId, {visibility: true});
        this.setState({drawGroupId: drawGroupId, selectedObject: null});
    };
    actionChanged = (data) => {
        if (data.action === "Delete") {
            this.deleteSelectedObject();
        } else {
            this.setState({action: data.action, geomType: data.geomType, selectedObject: null});
        }
    };
    deleteSelectedObject = () => {
        const group = this.props.sceneContext.getSceneObject(this.state.drawGroupId);
        let parent = null;
        group.traverse(c => {
            if (c === this.state.selectedObject) {
                parent = c.parent;
            }
        });
        if (parent) {
            parent.remove(this.state.selectedObject);
            while (parent.parent && !parent.isMesh && parent.children.length === 0 && parent !== group) {
                const grandparent = parent.parent;
                grandparent.remove(parent);
                parent = grandparent;
            }
            if (group.children.length === 0) {
                this.props.sceneContext.removeSceneObject(this.state.drawGroupId, () => {
                    this.ensureDrawGroup();
                });
            }
            this.setState({action: 'Pick', geomType: null, selectedObject: null});
            this.props.sceneContext.scene.notifyChange();
        }
    };
    objectCreated = (object) => {
        this.setState({action: 'Pick', geomType: null, selectedObject: object});
    };
    objectPicked = (object) => {
        this.setState({selectedObject: object});
    };
}

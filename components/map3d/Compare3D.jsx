/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {Plane, Vector3} from 'three';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import NumberInput from '../widgets/NumberInput';

import './style/Compare3D.css';


export default class Compare3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        enabled: false,
        clippedObjects: {},
        planeX: 0,
        planeY: 0,
        planeA: 0
    };
    componentWillUnmount() {
        this.clearClippingPlane();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.enabled && this.state !== prevState) {
            // Recompute clipping plane
            this.updateClippingPlane();
        } else if (!this.state.enabled && prevState.enabled) {
            this.clearClippingPlane();
        }
    }
    updateClippingPlane = () => {
        const point = new Vector3(this.state.planeX, this.state.planeY, 0);
        const alpha = this.state.planeA / 180 * Math.PI;
        const normal = new Vector3(Math.sin(alpha), Math.cos(alpha), 0);
        const leftPlane = new Plane();
        const rightPlane = new Plane();
        leftPlane.setFromNormalAndCoplanarPoint(normal, point);
        rightPlane.setFromNormalAndCoplanarPoint(-normal, point);
        Object.entries(this.state.clippedObjects).forEach(([objectId, config]) => {
            const planes = [];
            if (config.left) {
                planes.push(leftPlane);
            }
            if (config.right) {
                planes.push(rightPlane);
            }
            if (objectId === "__terrain") {
                this.props.sceneContext.map.clippingPlanes = planes;
            } else {
                this.props.sceneContext.getSceneObject(objectId).clippingPlanes = planes;
            }
        });
        this.props.sceneContext.scene.notifyChange();
    };
    clearClippingPlane = () => {
        Object.keys(this.state.clippedObjects).forEach(objectId => {
            if (objectId === "__terrain") {
                this.props.sceneContext.map.clippingPlanes = [];
            } else {
                this.props.sceneContext.getSceneObject(objectId).clippingPlanes = [];
            }
        });
        this.props.sceneContext.scene.notifyChange();
    };
    render() {
        return (
            <div>
                <SideBar icon="layers" id="Compare3D"
                    title={LocaleUtils.tr("appmenu.items.Compare3D")}
                    width="20em"
                >
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            </div>
        );
    }
    renderBody = () => {
        const sceneContext = this.props.sceneContext;
        const objects = {__terrain: {layertree: true, title: LocaleUtils.tr("map3d.terrain")}, ...sceneContext.sceneObjects};
        const objectIds = Object.keys(objects).filter(objectId => objects[objectId].layertree);
        return (
            <div className="compare3d-body" role="body">
                <div className="compare3d-title" onClick={this.toggleCompare}>
                    <Icon icon={this.state.enabled ? "checked" : "unchecked"} />
                    <span>{LocaleUtils.tr("compare3d.compare_objects")}</span>
                </div>
                <div className="compare3d-objects">
                    {["left", "right"].map(section => {
                        const clipState = this.state.clippedObjects;
                        let toggleAllIcon = "checked";
                        let toggleAllValue = true;
                        const toggleAllState = objectIds.reduce((res, id) => res + clipState[id]?.[section], 0);
                        if (toggleAllState === objectIds.length) {
                            toggleAllIcon = "unchecked";
                            toggleAllValue = false;
                        } else if (toggleAllState > 0) {
                            toggleAllIcon = "tristate";
                        }
                        return (
                            <div className="compare3d-section" key={"compare-" + section}>
                                <div
                                    className="compare3d-item compare3d-item-toggleall"
                                    onClick={() => this.toggleAllObjects(section, objectIds, toggleAllValue)}
                                    title={LocaleUtils.tr("compare3d.toggleall")}
                                >
                                    <Icon className="compare3d-item-checkbox" disabled={!this.state.enabled} icon={toggleAllIcon} />
                                    <span>{LocaleUtils.tr("compare3d.toggleall")}</span>
                                </div>
                                {objectIds.map(objectId => (
                                    <div
                                        className="compare3d-item"
                                        key={objectId}
                                        onClick={() => this.toggleObject(section, objectId)}
                                        title={objects[objectId].title ?? objectId}
                                    >
                                        <Icon className="compare3d-item-checkbox" disabled={!this.state.enabled} icon={clipState[objectId]?.[section] ? "unchecked" : "checked"} />
                                        <span>{objects[objectId].title ?? objectId}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
                <div className="compare3d-title">{LocaleUtils.tr("compare3d.clipplane")}</div>
                <table className="compare3d-planeconfig">
                    <tbody>
                        <tr>
                            <td>x</td>
                            <td><NumberInput disabled={!this.state.enabled} onChange={x => this.setState({planeX: x})} value={this.state.planeX}/></td>
                        </tr>
                        <tr>
                            <td>y</td>
                            <td><NumberInput disabled={!this.state.enabled} onChange={y => this.setState({planeY: y})} value={this.state.planeY}/></td>
                        </tr>
                        <tr>
                            <td>&#945;</td>
                            <td><NumberInput disabled={!this.state.enabled} onChange={a => this.setState({planeA: a})} suffix="°" value={this.state.planeA} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };
    toggleCompare = () => {
        this.setState(state => {
            const newState = {enabled: !state.enabled};
            if (newState.enabled) {
                // Position plane in current view
                newState.planeX = this.props.sceneContext.scene.view.controls.target.x;
                newState.planeY = this.props.sceneContext.scene.view.controls.target.y;
                newState.planeA = -this.props.sceneContext.scene.view.controls.getAzimuthalAngle() / Math.PI * 180 + 90;
            }
            return newState;
        });
    };
    toggleObject = (section, objectId) => {
        this.setState(state => ({
            clippedObjects: {
                ...state.clippedObjects,
                [objectId]: {
                    ...state.clippedObjects[objectId],
                    [section]: !state.clippedObjects[objectId]?.[section]
                }
            }
        }));
    };
    toggleAllObjects = (section, objectIds, value) => {
        this.setState(state => ({
            clippedObjects: objectIds.reduce((res, objectId) => ({
                ...res,
                [objectId]: {
                    ...state.clippedObjects[objectId],
                    [section]: value
                }
            }), {})
        }));
    };
}

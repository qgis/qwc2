/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {Group, Plane, Raycaster, Vector2, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';
import NumberInput from '../widgets/NumberInput';
import arrowModel from './models/arrow.glb';

import './style/Compare3D.css';


class Compare3D extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        sceneContext: PropTypes.object
    };
    state = {
        enabled: false,
        clippedObjects: {},
        planeX: 0,
        planeY: 0,
        planeA: 0
    };
    componentDidMount() {
        const loader = new GLTFLoader();
        loader.load(arrowModel, (gltf) => {
            gltf.scene.traverse((object) => {
                if (object.isMesh) {
                    object.material.depthTest = false;  // Ignores depth buffer
                    object.material.depthWrite = false; // Prevents modifying depth buffer
                }
            });
            gltf.scene.renderOrder = 9999999; // Ensures it is rendered last

            const leftArrow = gltf.scene.clone();
            leftArrow.position.y = -4;
            leftArrow.rotation.z = - 0.5 * Math.PI;
            const rightArrow = gltf.scene.clone();
            rightArrow.position.y = 4;
            rightArrow.rotation.z = 0.5 * Math.PI;
            this.arrows = new Group();
            this.arrows.add(leftArrow);
            this.arrows.add(rightArrow);
        });
    }
    componentWillUnmount() {
        this.clearClippingPlane();
        if (this.arrows) {
            this.arrows.traverse(obj => obj.dispose?.());
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.enabled && this.props.active && !prevProps.active) {
            this.enableArrows();
        } else if (this.state.enabled && !this.props.active && prevProps.active) {
            this.disableArrows();
        }
        if (this.state.enabled && this.state !== prevState) {
            if (this.props.active && !prevState.enabled) {
                this.enableArrows();
            }
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
        rightPlane.setFromNormalAndCoplanarPoint(normal.multiplyScalar(-1), point);
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
                const object = this.props.sceneContext.getSceneObject(objectId);
                object.clippingPlanes = planes;
                object.traverse(child => {
                    if (child.material) {
                        child.material.clippingPlanes = planes;
                        child.material.clipShadows = true;
                    }
                });
            }
        });
        this.props.sceneContext.scene.notifyChange();
        this.positionArrows(this.state.planeX, this.state.planeY, this.state.planeA);
    };
    clearClippingPlane = () => {
        Object.keys(this.state.clippedObjects).forEach(objectId => {
            if (objectId === "__terrain") {
                this.props.sceneContext.map.clippingPlanes = [];
            } else {
                const object = this.props.sceneContext.getSceneObject(objectId);
                object.clippingPlanes = [];
                object.traverse(child => {
                    if (child.material) {
                        child.material.clippingPlanes = [];
                        child.material.clipShadows = false;
                    }
                });
            }
        });
        if (this.props.active) {
            this.disableArrows();
        }
        this.props.sceneContext.scene.notifyChange();
    };
    enableArrows = () => {
        this.props.sceneContext.addSceneObject("__compareArrows", this.arrows);
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.centerArrowsInView);

        const renderer = this.props.sceneContext.scene.renderer;
        renderer.domElement.addEventListener("pointerdown", this.dragArrows);
    };
    disableArrows = () => {
        this.props.sceneContext.scene.view.controls?.removeEventListener?.('change', this.centerArrowsInView);
        this.props.sceneContext.removeSceneObject("__compareArrows");
        this.props.sceneContext.scene.renderer.domElement.removeEventListener("pointerdown", this.dragArrows);
    };
    dragArrows = (ev) => {
        const mousePos = (event) => {
            const rect = event.target.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            return new Vector2(x, y);
        };
        const camera = this.props.sceneContext.scene.view.camera;
        const raycaster = new Raycaster();
        raycaster.setFromCamera(mousePos(ev), camera);
        const intersects = raycaster.intersectObject(this.arrows).length > 0;
        if (!intersects) {
            return;
        }
        const plane = new Plane().setFromNormalAndCoplanarPoint(new Vector3(0, 0, 1), this.arrows.position);
        const startPos = raycaster.ray.intersectPlane(plane, new Vector3());
        const planePos = new Vector2(this.state.planeX, this.state.planeY);
        const alpha = this.state.planeA / 180 * Math.PI;
        const planeNormal = new Vector3(Math.sin(alpha), Math.cos(alpha), 0);
        const moveArrows = (event) => {
            raycaster.setFromCamera(mousePos(event), camera);
            plane.setFromNormalAndCoplanarPoint(new Vector3(0, 0, 1), this.arrows.position);
            const pos = raycaster.ray.intersectPlane(plane, new Vector3());
            const delta = planeNormal.clone().multiplyScalar(
                new Vector3().copy(pos.sub(startPos)).dot(planeNormal)
            );
            this.setState({planeX: planePos.x + delta.x, planeY: planePos.y + delta.y});
            this.positionArrows(planePos.x + delta.x, planePos.y + delta.y, this.state.planeA);
        };
        this.props.sceneContext.scene.view.controls.enabled = false;
        ev.view.addEventListener("pointermove", moveArrows);
        ev.view.addEventListener("pointerup", () => {
            this.props.sceneContext.scene.view.controls.enabled = true;
            ev.view.removeEventListener("pointermove", moveArrows);
        }, {once: true});
    };
    centerArrowsInView = () => {
        const inter = this.props.sceneContext.getSceneIntersection(0, 0);
        const center = inter?.point ?? this.props.sceneContext.scene.view.controls.target.clone();
        const alpha = this.state.planeA / 180 * Math.PI;
        const dir = new Vector3(Math.cos(alpha), -Math.sin(alpha), 0);
        const curPos = new Vector3(this.state.planeX, this.state.planeY, 0);
        const newPos = curPos.add(dir.multiplyScalar(center.sub(curPos).dot(dir)));
        this.setState({planeX: newPos.x, planeY: newPos.y});
        this.positionArrows(newPos.x, newPos.y, this.state.planeA);
    };
    positionArrows = (x, y, alpha) => {
        const target = new Vector3(x, y, 0);
        const distance = this.props.sceneContext.scene.view.camera.position.distanceTo(target);
        const scale = Math.max(1, distance / 200);
        const z = this.props.sceneContext.getTerrainHeightFromMap([x, y]) ?? 0;

        this.arrows.position.x = target.x;
        this.arrows.position.y = target.y;
        this.arrows.position.z = z;
        this.arrows.rotation.z = -alpha / 180 * Math.PI;
        this.arrows.scale.set(scale, scale, scale);
        this.arrows.updateMatrixWorld();
    };
    render() {
        return (
            <SideBar icon="layers" id="Compare3D"
                title={LocaleUtils.tr("appmenu.items.Compare3D")}
                width="20em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
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
                                    onClick={this.state.enabled ? () => this.toggleAllObjects(section, objectIds, toggleAllValue) : null}
                                    title={LocaleUtils.tr("compare3d.toggleall")}
                                >
                                    <Icon className="compare3d-item-checkbox" disabled={!this.state.enabled} icon={toggleAllIcon} />
                                    <span>{LocaleUtils.tr("compare3d.toggleall")}</span>
                                </div>
                                {objectIds.map(objectId => (
                                    <div
                                        className="compare3d-item"
                                        key={objectId}
                                        onClick={this.state.enabled ? () => this.toggleObject(section, objectId) : null}
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

export default connect(state => ({
    active: state.task.id === "Compare3D"
}), {

})(Compare3D);

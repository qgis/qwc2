/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Vector2} from 'three';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';
import SideBar from '../SideBar';

import './style/HideObjects3D.css';


class HideObjects3D extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        sceneContext: PropTypes.object
    };
    state = {
        hiddenObjects: []
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('mousedown', this.pickOnRelease);
    }
    componentDidUpdate(prevProps) {
        if (this.props.sceneContext.scene !== prevProps.sceneContext?.scene) {
            this.setState({hiddenObjects: []});
        }
    }
    renderBody = () => {
        return (
            <div className="hideobjects3d-body">
                {isEmpty(this.state.hiddenObjects) ? (
                    <i>{LocaleUtils.tr("hideobjects3d.clickonmap")}</i>
                ) : (
                    <div>
                        <div className="hideobjects3d-list">
                            {this.state.hiddenObjects.map(entry => (
                                <div key={entry.object.uuid + entry.batchId}
                                    onMouseEnter={() => this.showHighlight(entry)}
                                    onMouseLeave={() => this.hideHighlight(entry)}
                                >
                                    <span>{LocaleUtils.tr("hideobjects3d.object")}</span>
                                    <Icon icon="eye" onClick={() => this.restoreObject(entry)} title={LocaleUtils.tr("hideobjects3d.restore")} />
                                </div>

                            ))}
                        </div>
                        <div className="hideobjects3d-restorebutton">
                            <button className="button" onClick={this.restoreAll}>{LocaleUtils.tr("hideobjects3d.restoreall")}</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    render() {
        return (
            <SideBar icon={"eye"}
                id="HideObjects3D"
                title={LocaleUtils.tr("appmenu.items.HideObjects3D")} width="20em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    clear = () => {
        this.setState({pickAttrs: null});
        this.props.sceneContext.removeSceneObject("__identify3d_highlight");
    };
    pickOnRelease = (ev) => {
        if (ev.button !== 0) {
            return;
        }
        ev.view.addEventListener('mouseup', this.pick, {once: true});
        ev.view.addEventListener('mousemove', () => {
            ev.view.removeEventListener('mouseup', this.pick);
        }, {once: true});
    };
    pick = (ev) => {
        if (this.props.enabled !== true) {
            return;
        }
        this.clear();

        // Setup raycaster
        const raycaster = new Raycaster();
        raycaster.firstHitOnly = true;
        const camera = this.props.sceneContext.scene.view.camera;
        const rect = ev.target.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new Vector2(x, y), camera);

        const picks = [];
        Object.entries(this.props.sceneContext.sceneObjects).forEach(([objId, options]) => {
            if (!options.layertree || !options.visibility) {
                return;
            }
            const object = this.props.sceneContext.getSceneObject(objId);
            if (object.tiles?.raycast) {
                const intersections = [];
                object.tiles.raycast(raycaster, intersections);
                intersections.forEach(entry => { entry.isTilePick = true; });
                picks.push(...intersections);
            } else {
                picks.push(...raycaster.intersectObjects([object], true));
            }
        });
        picks.sort((a, b) => a.distance - b.distance);

        if (isEmpty(picks)) {
            return;
        } else if (picks[0].isTilePick) {
            this.hideTilePick(picks[0]);
        } else {
            this.hideObjectPick(picks[0]);
        }
    };
    hideTilePick = (pick) => {
        const batchidAttr = pick.object.geometry.getAttribute( '_batchid' );
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');

        const pickBatchId = batchidAttr.getX(pick.face.a);

        // Extract/shift batch geometry
        const pickPosition = [];
        const pickNormal = [];
        batchidAttr.array.forEach((batchId, idx) => {
            if (batchId === pickBatchId) {
                pickPosition.push(...posAttr.array.slice(3 * idx, 3 * idx + 3));
                pickNormal.push(...norAttr.array.slice(3 * idx, 3 * idx + 3));

                posAttr.array[3 * idx + 2] -= 100000;
            }
        });
        posAttr.needsUpdate = true;
        this.props.sceneContext.scene.notifyChange();

        // Hide label
        let rootObject = pick.object;
        while (!rootObject.batchTable) {
            rootObject = rootObject.parent;
        }
        const pickLabel = rootObject.userData.tileLabels?.[pickBatchId];
        if (pickLabel) {
            pickLabel.labelObject.visible = false;
        }

        // Create highlight geometry
        this.storeHiddenObject(pick, pickPosition, pickNormal, null, pickBatchId);
    };
    hideObjectPick = (pick) => {
        pick.object.visible = false;
        this.props.sceneContext.scene.notifyChange();

        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const index = pick.object.geometry.getIndex();

        // Create highlight geometry
        this.storeHiddenObject(pick, posAttr.array, norAttr.array, index);
    };
    storeHiddenObject = (pick, position, normal, index = null, batchId = null) => {
        const material = new MeshStandardMaterial({color: 0xff0000});
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
        geometry.setIndex(index);
        const mesh = new Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.applyMatrix4(pick.object.matrixWorld);
        mesh.updateMatrixWorld();

        this.setState(state => ({
            hiddenObjects: [
                ...state.hiddenObjects,
                {
                    object: pick.object,
                    isTileObject: pick.isTilePick,
                    batchId: batchId,
                    highlight: mesh
                }
            ]
        }));

    };
    showHighlight = (entry) => {
        this.props.sceneContext.addSceneObject(entry.highlight.uuid, entry.highlight);
    };
    hideHighlight = (entry) => {
        this.props.sceneContext.removeSceneObject(entry.highlight.uuid);
    };
    restoreObject = (entry) => {
        if (entry.isTileObject) {
            const batchidAttr = entry.object.geometry.getAttribute( '_batchid' );
            const posAttr = entry.object.geometry.getAttribute('position');

            // Unshift batch geometry
            batchidAttr.array.forEach((batchId, idx) => {
                if (batchId === entry.batchId) {
                    posAttr.array[3 * idx + 2] += 100000;
                }
            });
            posAttr.needsUpdate = true;

            // Restore label
            let rootObject = entry.object;
            while (!rootObject.batchTable) {
                rootObject = rootObject.parent;
            }
            const pickLabel = rootObject.userData.tileLabels[entry.batchId];
            if (pickLabel) {
                pickLabel.labelObject.visible = true;
            }

        } else {
            entry.object.visible = true;
        }
        this.hideHighlight(entry);
        this.props.sceneContext.scene.notifyChange();
        this.setState(state => ({
            hiddenObjects: state.hiddenObjects.filter(x => x !== entry)
        }));
    };
    restoreAll = () => {
        [...this.state.hiddenObjects].forEach(this.restoreObject);
    };
}

export default connect((state) => ({
    enabled: state.task.id === "HideObjects3D"
}), {

})(HideObjects3D);

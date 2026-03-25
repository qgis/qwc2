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
import {BufferAttribute, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector2, Vector3} from 'three';

import Icon from '../../components/Icon';
import {TileMeshHelper} from '../../components/map3d/utils/MiscUtils3D';
import SideBar from '../../components/SideBar';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/HideObjects3D.css';


/**
 * Hide objects in the 3D map.
 */
class HideObjects3D extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        sceneContext: PropTypes.object
    };
    state = {
        hiddenObjects: []
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('pointerdown', this.pickOnRelease);
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
                                <div key={entry.object.uuid + entry.featureId}
                                    onMouseEnter={() => this.showHighlight(entry)}
                                    onMouseLeave={() => this.hideHighlight(entry)}
                                >
                                    <span>{LocaleUtils.tr("hideobjects3d.object") + " " + (entry.featureId ?? "")}</span>
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
    pickOnRelease = (ev) => {
        if (ev.button !== 0) {
            return;
        }
        ev.view.addEventListener('pointerup', this.pick, {once: true});
        ev.view.addEventListener('pointermove', () => {
            ev.view.removeEventListener('pointerup', this.pick);
        }, {once: true});
    };
    pick = (ev) => {
        if (this.props.enabled !== true) {
            return;
        }

        // Setup raycaster
        const raycaster = new Raycaster();
        raycaster.firstHitOnly = true;
        const camera = this.props.sceneContext.scene.view.camera;
        const rect = ev.target.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new Vector2(x, y), camera);

        const picks = [];
        Object.values(this.props.sceneContext.objectTree).forEach(entry => {
            if (!entry.objectId || !this.props.sceneContext.objectIsVisible(entry.objectId)) {
                return;
            }
            const object = this.props.sceneContext.getSceneObject(entry.objectId);
            if (object.tiles?.raycast) {
                const intersections = [];
                object.tiles.raycast(raycaster, intersections);
                intersections.forEach(inter => { inter.isTilePick = true; });
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
        const posAttr = pick.object.geometry.getAttribute('position');

        // Ensure geometry is indexed
        if (!pick.object.geometry.index) {
            const indices = new Uint32Array(posAttr.count);
            for (let i = 0; i < posAttr.count; i++) {
                indices[i] = i;
            }
            pick.object.geometry.setIndex(new BufferAttribute(indices, 1));
        }

        const helper = new TileMeshHelper(pick.object);
        const pickFeatureId = helper.getPickFeatureId(pick);

        // Extract feature geometry
        const pickPosition = [];
        const pickNormal = [];
        helper.forEachFeatureTriangle(pickFeatureId, (i0, i1, i2, matrix, normalMatrix) => {
            pickPosition.push(...helper.getPosition(i0, matrix).toArray());
            pickPosition.push(...helper.getPosition(i1, matrix).toArray());
            pickPosition.push(...helper.getPosition(i2, matrix).toArray());
            pickNormal.push(...helper.getNormal(i0, normalMatrix).toArray());
            pickNormal.push(...helper.getNormal(i1, normalMatrix).toArray());
            pickNormal.push(...helper.getNormal(i2, normalMatrix).toArray());
        });

        // Filter indices
        if (pick.object.isInstancedMesh) {
            if (!pick.object.userData.originalMatrix) {
                pick.object.userData.originalMatrix = {};
            }
            const matrix = new Matrix4();
            pick.object.getMatrixAt(pickFeatureId, matrix);
            pick.object.userData.originalMatrix[pickFeatureId] = matrix.clone();
            matrix.setPosition(new Vector3(1e9, 1e9, 1e9));
            pick.object.setMatrixAt(pickFeatureId, matrix);
            pick.object.instanceMatrix.needsUpdate = true;
        } else {
            if (!pick.object.userData.originalIndex) {
                pick.object.userData.originalIndex = pick.object.geometry.index.array.slice();
            }
            const filteredIndices = pick.object.geometry.index.array.filter(idx => {
                return helper.featureIdAttr.getX(idx) !== pickFeatureId;
            });
            pick.object.geometry.setIndex(new BufferAttribute(new Uint32Array(filteredIndices), 1));
        }
        pick.object.geometry?.computeBoundsTree?.();

        // Hide label
        const pickLabel = helper.getTileUserData().tileLabels?.[pickFeatureId];
        if (pickLabel) {
            pickLabel.labelObject.visible = false;
        }
        this.props.sceneContext.scene.notifyChange();

        // Store hidden object metadata
        this.storeHiddenObject(pick, pickPosition, pickNormal, null, pickFeatureId);
    };
    hideObjectPick = (pick) => {
        pick.object.visible = false;
        this.props.sceneContext.scene.notifyChange();

        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const index = pick.object.geometry.getIndex();

        // Create highlight geometry
        this.storeHiddenObject(pick, posAttr.array, norAttr?.array, index);
    };
    storeHiddenObject = (pick, position, normal, index = null, featureId = null) => {
        const material = new MeshStandardMaterial({color: 0xff0000});
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
        if (normal) {
            geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
        }
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
                    featureId: featureId,
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
            const helper = new TileMeshHelper(entry.object);

            // Re-add filtered indices
            if (entry.object.isInstancedMesh) {
                entry.object.setMatrixAt(entry.featureId, entry.object.userData.originalMatrix[entry.featureId]);
                entry.object.instanceMatrix.needsUpdate = true;
            } else {
                const filteredIndices = entry.object.userData.originalIndex.filter(i => helper.featureIdAttr.getX(i) === entry.featureId);
                const combined = new Uint32Array(entry.object.geometry.index.array.length + filteredIndices.length);
                combined.set(entry.object.geometry.index.array, 0);
                combined.set(new Uint32Array(filteredIndices), entry.object.geometry.index.array.length);
                entry.object.geometry.setIndex(new BufferAttribute(combined, 1));
            }
            entry.object.geometry?.computeBoundsTree?.();

            // Restore label
            const pickLabel = helper.getTileUserData().tileLabels?.[entry.featureId];
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

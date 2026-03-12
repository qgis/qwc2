/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {Color, BufferAttribute, BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, Mesh, MeshStandardMaterial, Raycaster, Vector2, Vector3} from 'three';

import Icon from '../../components/Icon';
import {computeOBBXY, TileMeshHelper, updateObjectLabel} from '../../components/map3d/utils/MiscUtils3D';
import SideBar from '../../components/SideBar';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/MeasureObjects3D.css';


/**
 * Displays the measurements of the oriented bounds of objects selected in the 3D map.
 */
class MeasureObjects3D extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        sceneContext: PropTypes.object
    };
    state = {
        measuredObjects: {}
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('pointerdown', this.pickOnRelease);
    }
    componentDidUpdate(prevProps) {
        if (this.props.sceneContext.scene !== prevProps.sceneContext?.scene) {
            this.setState({measuredObjects: {}});
        }
    }
    renderBody = () => {
        return (
            <div className="measureobjects3d-body">
                {isEmpty(this.state.measuredObjects) ? (
                    <i>{LocaleUtils.tr("measureobjects3d.clickonmap")}</i>
                ) : (
                    <div>
                        <div className="measureobjects3d-list">
                            {Object.values(this.state.measuredObjects).map(entry => (
                                <div key={entry.colorBoxId}
                                    onMouseEnter={() => this.showHighlight(entry)}
                                    onMouseLeave={() => this.hideHighlight(entry)}
                                >
                                    <span>{LocaleUtils.tr("measureobjects3d.object") + " " + (entry.featureId ?? "")}</span>
                                    <Icon icon="trash" onClick={() => this.removeMeasurement(entry)} title={LocaleUtils.tr("measureobjects3d.remove")} />
                                </div>

                            ))}
                        </div>
                        <div className="measureobjects3d-restorebutton">
                            <button className="button" onClick={this.removeAll}>{LocaleUtils.tr("measureobjects3d.removeall")}</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    render() {
        return (
            <SideBar icon="measure"
                id="MeasureObjects3D"
                title={LocaleUtils.tr("appmenu.items.MeasureObjects3D")} width="20em"
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
            this.measureTilePick(picks[0]);
        } else {
            this.measureObjectPick(picks[0]);
        }
    };
    measureTilePick = (pick) => {
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');

        // Ensure geometry is indexed
        if (!pick.object.geometry.index) {
            const indices = new Uint32Array(posAttr.count);
            for (let i = 0; i < posAttr.count; i++) {
                indices[i] = i;
            }
            pick.object.geometry.setIndex(new BufferAttribute(indices, 1));
        }

        const helper = new TileMeshHelper(pick.object);
        const pickFeatureId = helper.getFeatureId(pick.face);
        const pickUuid = pick.object.uuid + "#" + pickFeatureId;
        if (pickUuid in this.state.measuredObjects) {
            return;
        }

        // Extract feature geometry
        const pickPosition = [];
        const pickNormal = [];
        helper.forEachFeatureTriangle(pickFeatureId, (i0, i1, i2) => {
            pickPosition.push(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
            pickPosition.push(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
            pickPosition.push(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));
            pickNormal.push(norAttr.getX(i0), norAttr.getY(i0), norAttr.getZ(i0));
            pickNormal.push(norAttr.getX(i1), norAttr.getY(i1), norAttr.getZ(i1));
            pickNormal.push(norAttr.getX(i2), norAttr.getY(i2), norAttr.getZ(i2));
        });

        // Store measured object metadata
        this.storeMeasuredObject(pick, pickPosition, pickNormal, null, pickFeatureId, pickUuid);
    };
    measureObjectPick = (pick) => {
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const index = pick.object.geometry.getIndex();

        if (pick.object.uuid in this.state.measuredObjects) {
            return;
        }

        // Create highlight geometry
        this.storeMeasuredObject(pick, posAttr.array, norAttr.array, index, null, pick.object.uuid);
    };
    storeMeasuredObject = (pick, position, normal, index = null, featureId, uuid) => {
        const material = new MeshStandardMaterial({color: 0xff0000});
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
        geometry.setIndex(index);
        const mesh = new Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.applyMatrix4(pick.object.matrixWorld);
        mesh.updateMatrixWorld();
        const colorBox = this.createAxisColoredWireBox(mesh);
        this.props.sceneContext.addSceneObject(colorBox.uuid, colorBox);

        this.setState(state => ({
            measuredObjects: {
                ...state.measuredObjects,
                [uuid]: {
                    uuid: uuid,
                    featureId: featureId,
                    highlight: mesh,
                    colorBoxId: colorBox.uuid
                }
            }
        }));

    };
    showHighlight = (entry) => {
        this.props.sceneContext.addSceneObject(entry.highlight.uuid, entry.highlight);
    };
    hideHighlight = (entry) => {
        this.props.sceneContext.removeSceneObject(entry.highlight.uuid);
    };
    removeMeasurement = (entry) => {
        this.hideHighlight(entry);
        this.props.sceneContext.removeSceneObject(entry.colorBoxId);
        this.setState(state => {
            const newMeasuredObjects = {...state.measuredObjects};
            delete newMeasuredObjects[entry.uuid];
            return {measuredObjects: newMeasuredObjects};
        });
    };
    removeAll = () => {
        Object.values(this.state.measuredObjects).forEach(entry => {
            this.hideHighlight(entry);
            this.props.sceneContext.removeSceneObject(entry.colorBoxId);
        });
        this.setState({measuredObjects: {}});
    };
    createAxisColoredWireBox(mesh) {
        const obox = computeOBBXY(mesh);

        const ax = obox.axes[0].clone().multiplyScalar(obox.halfSizes.x);
        const ay = obox.axes[1].clone().multiplyScalar(obox.halfSizes.y);
        const az = obox.axes[2].clone().multiplyScalar(obox.halfSizes.z);

        const o = new Vector3();

        const corners = [
            o.clone().sub(ax).sub(ay).sub(az), // 0
            o.clone().add(ax).sub(ay).sub(az), // 1
            o.clone().add(ax).add(ay).sub(az), // 2
            o.clone().sub(ax).add(ay).sub(az), // 3
            o.clone().sub(ax).sub(ay).add(az), // 4
            o.clone().add(ax).sub(ay).add(az), // 5
            o.clone().add(ax).add(ay).add(az), // 6
            o.clone().sub(ax).add(ay).add(az)  // 7
        ];

        const vertices = [
            // bottom rectangle
            ...corners[0].toArray(), ...corners[1].toArray(),
            ...corners[1].toArray(), ...corners[2].toArray(),
            ...corners[2].toArray(), ...corners[3].toArray(),
            ...corners[3].toArray(), ...corners[0].toArray(),

            // top rectangle
            ...corners[4].toArray(), ...corners[5].toArray(),
            ...corners[5].toArray(), ...corners[6].toArray(),
            ...corners[6].toArray(), ...corners[7].toArray(),
            ...corners[7].toArray(), ...corners[4].toArray(),

            // vertical edges
            ...corners[0].toArray(), ...corners[4].toArray(),
            ...corners[1].toArray(), ...corners[5].toArray(),
            ...corners[2].toArray(), ...corners[6].toArray(),
            ...corners[3].toArray(), ...corners[7].toArray()
        ];

        const geometry = new BufferGeometry();
        geometry.setAttribute(
            "position",
            new Float32BufferAttribute(vertices, 3)
        );

        const red = new Color(1, 0, 0);
        const green = new Color(0, 1, 0);
        const blue = new Color(0, 0, 1);
        const colors = [
            ...red.toArray(), ...red.toArray(),
            ...green.toArray(), ...green.toArray(),
            ...red.toArray(), ...red.toArray(),
            ...green.toArray(), ...green.toArray(),
            ...red.toArray(), ...red.toArray(),
            ...green.toArray(), ...green.toArray(),
            ...red.toArray(), ...red.toArray(),
            ...green.toArray(), ...green.toArray(),
            ...blue.toArray(), ...blue.toArray(),
            ...blue.toArray(), ...blue.toArray(),
            ...blue.toArray(), ...blue.toArray(),
            ...blue.toArray(), ...blue.toArray()
        ];

        geometry.setAttribute(
            "color",
            new Float32BufferAttribute(colors, 3)
        );

        const material = new LineBasicMaterial({vertexColors: true});

        const boxmesh = new LineSegments(geometry, material);
        boxmesh.position.copy(obox.center);
        boxmesh.updateMatrixWorld(true);
        const dim1 = Math.round(2 * obox.halfSizes.x);
        const dim2 = Math.round(2 * obox.halfSizes.y);
        const dim3 = Math.round(2 * obox.halfSizes.z);
        boxmesh.userData.label = `<span class="map3d-measure-label"><span style="color: red">${dim1}</span> ⛌ <span style="color: green">${dim2}</span> ⛌ <span style="color: blue">${dim3}</span></<span>`;
        boxmesh.userData.labelOffset = 15;
        updateObjectLabel(boxmesh, this.props.sceneContext);
        return boxmesh;
    }
}

export default connect((state) => ({
    enabled: state.task.id === "MeasureObjects3D"
}), {

})(MeasureObjects3D);

/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Vector2} from 'three';

import ResizeableWindow from '../../components/ResizeableWindow';
import LocaleUtils from '../../utils/LocaleUtils';

import '../../components/style/IdentifyViewer.css';


class Identify3D extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        identifyEnabled: PropTypes.bool,
        sceneContext: PropTypes.object
    };
    state = {
        pickAttrs: null
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('pointerdown', this.identifyOnRelease);
    }
    componentDidUpdate(prevProps) {
        if (!this.props.identifyEnabled && prevProps.identifyEnabled) {
            this.clear();
        }
    }
    render() {
        if (this.state.pickAttrs === null) {
            return null;
        }
        return (
            <ResizeableWindow dockable={"left"} icon="info-sign"
                initialHeight={320} initialWidth={240}
                initialX={0} initialY={0}
                initiallyDocked
                onClose={this.clear} title={LocaleUtils.tr("identify.title")}
            >
                <div className="identify-body" role="body">
                    {isEmpty(this.state.pickAttrs) ? (
                        <span><i>{LocaleUtils.tr("identify.noattributes")}</i></span>
                    ) : (
                        <div className="identify-result-box">
                            <table className="attribute-list">
                                <tbody>
                                    {Object.entries(this.state.pickAttrs).map(([key, value]) => (
                                        <tr key={key}>
                                            <td className="identify-attr-title"><i>{key}</i></td>
                                            <td className="identify-attr-value">{value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </ResizeableWindow>
        );
    }
    clear = () => {
        this.setState({pickAttrs: null});
        this.props.sceneContext.removeSceneObject("__identify3d_highlight");
    };
    identifyOnRelease = (ev) => {
        if (ev.button !== 0) {
            return;
        }
        ev.view.addEventListener('pointerup', this.identify, {once: true});
        ev.view.addEventListener('pointermove', () => {
            ev.view.removeEventListener('pointerup', this.identify);
        }, {once: true});
    };
    identify = (ev) => {
        if (this.props.identifyEnabled !== true) {
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
            this.identifyTilePick(picks[0]);
        } else {
            this.identifyObjectPick(picks[0]);
        }
    };
    identifyTilePick = (pick) => {
        const batchidAttr = pick.object.geometry.getAttribute('_batchid');
        if (!batchidAttr) {
            return;
        }
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');

        const pickBatchId = batchidAttr.getX(pick.face.a);

        // Extract batch geometry
        const pickPosition = [];
        const pickNormal = [];
        batchidAttr.array.forEach((batchId, idx) => {
            if (batchId === pickBatchId) {
                pickPosition.push(...posAttr.array.slice(3 * idx, 3 * idx + 3));
                pickNormal.push(...norAttr.array.slice(3 * idx, 3 * idx + 3));
            }
        });

        // Add selection object
        this.addHiglightGeometry(pick.object.matrixWorld, pickPosition, pickNormal);

        // Extract attributes from batch table and set pick attrs
        let batchTableObject = pick.object;
        while (!batchTableObject.batchTable) {
            batchTableObject = batchTableObject.parent;
        }
        const batchTable = batchTableObject.batchTable;
        const batchAttrs = batchTable.getDataFromId(pickBatchId);
        if (this.props.sceneContext.options.tileInfoServiceUrl) {
            const url = this.props.sceneContext.options.tileInfoServiceUrl.replace(
                '{tileset}', batchTableObject.userData.tilesetName
            ).replace(
                '{objectid}', batchAttrs[batchTableObject.userData.batchIdAttr]
            );
            axios.get(url).then(response => {
                this.setState({pickAttrs: {
                    ...batchAttrs,
                    ...response.data
                }});
            }).catch(() => {
                this.setState({pickAttrs: batchAttrs});
            });
        } else {
            this.setState({pickAttrs: batchAttrs});
        }
    };
    identifyObjectPick = (pick) => {
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const index = pick.object.geometry.getIndex();
        // Add selection object
        this.addHiglightGeometry(pick.object.matrixWorld, posAttr.array, norAttr.array, index);

        // Set pick attrs
        this.setState({pickAttrs: pick.object.userData});
    };
    addHiglightGeometry = (matrixWorld, position, normal, index = null) => {
        const material = new MeshStandardMaterial({color: 0xff0000});
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
        geometry.setIndex(index);
        const mesh = new Mesh(geometry, material);
        mesh.applyMatrix4(matrixWorld);
        mesh.updateMatrixWorld();
        mesh.receiveShadow = true;
        this.props.sceneContext.addSceneObject("__identify3d_highlight", mesh);
    };
}

export default connect((state) => ({
    identifyEnabled: state.task.identifyEnabled
}), {

})(Identify3D);

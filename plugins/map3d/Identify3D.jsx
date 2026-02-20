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
import DOMPurify from 'dompurify';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Vector2} from 'three';

import {TileMeshHelper} from '../../components/map3d/utils/MiscUtils3D';
import ResizeableWindow from '../../components/ResizeableWindow';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';

import '../../components/style/IdentifyViewer.css';


/**
 * Query attributes of objects in the 3D map.
 */
class Identify3D extends React.Component {
    static propTypes = {
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        identifyEnabled: PropTypes.bool,
        sceneContext: PropTypes.object,
        /** URL to service for querying additional tile information.
         * Can contain the `{tileset}` and `{objectid}` placeholders.
         * Expected to return a JSON dict with attributes.*/
        tileInfoServiceUrl: PropTypes.string
    };
    static defaultProps = {
        geometry: {
            initialWidth: 240,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        }
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
            <ResizeableWindow dockable={this.props.geometry.side} icon="info-sign"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.clear} title={LocaleUtils.tr("identify.title")}
            >
                <div className="identify-body">
                    {isEmpty(this.state.pickAttrs) ? (
                        <span><i>{LocaleUtils.tr("identify.noattributes")}</i></span>
                    ) : (
                        <div className="identify-result-box">
                            <table className="attribute-list">
                                <tbody>
                                    {Object.entries(this.state.pickAttrs).map(([key, value]) => (
                                        <tr key={key}>
                                            <td className="identify-attr-title"><i>{key}</i></td>
                                            <td className="identify-attr-value" dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(DOMPurify.sanitize(value))}} />
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
        Object.values(this.props.sceneContext.objectTree).forEach(entry => {
            if (!entry.objectId || !entry.visibility || entry.opacity === 0) {
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
            this.identifyTilePick(picks[0]);
        } else {
            this.identifyObjectPick(picks[0]);
        }
    };
    identifyTilePick = (pick) => {
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const helper = new TileMeshHelper(pick.object);
        if (!helper.isValid()) {
            return;
        }
        const pickFeatureId = helper.getFeatureId(pick.face);
        const featureAttrs = helper.getFeatureProperties(pickFeatureId);

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

        // Add selection object
        this.addHiglightGeometry(pick.object.matrixWorld, pickPosition, pickNormal);

        // Gather extra attributes
        if (this.props.tileInfoServiceUrl) {
            const {tilesetName, featureIdAttr} = helper.getTileUserData();
            const url = this.props.tileInfoServiceUrl.replace(
                '{tileset}', tilesetName
            ).replace(
                '{objectid}', featureAttrs[featureIdAttr]
            );
            axios.get(url).then(response => {
                response.data.forEach(attr => {
                    if (attr.name in featureAttrs && featureAttrs[attr.name] === attr.value) {
                        // Use attribute alias
                        delete featureAttrs[attr.name];
                    }
                    featureAttrs[attr.alias] = attr.value;
                });
                this.setState({pickAttrs: featureAttrs});
            }).catch(() => {
                this.setState({pickAttrs: featureAttrs});
            });
        } else {
            this.setState({pickAttrs: featureAttrs});
        }
    };
    identifyObjectPick = (pick) => {
        const posAttr = pick.object.geometry.getAttribute('position');
        const norAttr = pick.object.geometry.getAttribute('normal');
        const index = pick.object.geometry.getIndex();
        // Add selection object
        this.addHiglightGeometry(pick.object.matrixWorld, posAttr.array, norAttr?.array, index);

        // Set pick attrs
        this.setState({pickAttrs: pick.object.userData});
    };
    addHiglightGeometry = (matrixWorld, position, normal, index = null) => {
        const material = new MeshStandardMaterial({color: 0xff0000});
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
        if (normal) {
            geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
        }
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

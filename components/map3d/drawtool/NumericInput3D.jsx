/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';
import {Box3} from 'three';

import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import LocaleUtils from '../../../utils/LocaleUtils';
import ResizeableWindow from '../../ResizeableWindow';
import ButtonBar from '../../widgets/ButtonBar';
import NumberInput from '../../widgets/NumberInput';

import './style/NumericInput3D.css';


export default class NumericInput3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        selectedObject: PropTypes.object,
        toggleNumericInput: PropTypes.func,
        transformControls: PropTypes.object
    };
    state = {
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        scale: [1, 1, 1],
        size: null,
        anchors: ['center', 'center', 'begin']
    };
    constructor(props) {
        super(props);
        this.el = document.createElement("div");
        this.props.sceneContext.scene.viewport.parentElement.appendChild(this.el);
    }
    componentDidMount() {
        this.props.transformControls.addEventListener('change', this.updateStateFromObject);
        this.updateStateFromObject();
    }
    componentDidUpdate(prevProps) {
        if (this.props.selectedObject !== prevProps.selectedObject) {
            this.updateStateFromObject();
        }
    }
    componentWillUnmount() {
        this.props.sceneContext.scene.viewport.parentElement.removeChild(this.el);
        this.props.transformControls.removeEventListener('change', this.updateStateFromObject);
    }
    render() {
        const pos = this.state.pos;
        const rot = this.state.rot;
        const scale = this.state.scale;
        const size = this.state.size;
        const disabled = !this.props.selectedObject;
        const unit = CoordinatesUtils.getUnits(this.props.sceneContext.mapCrs);
        const hanchors = [
            {key: 'begin', icon: 'after'},
            {key: 'center', icon: 'middle_h'},
            {key: 'end', icon: 'before'}
        ];
        const vanchors = [
            {key: 'begin', icon: 'above'},
            {key: 'center', icon: 'middle_v'},
            {key: 'end', icon: 'below'}
        ];
        const contents = (
            <ResizeableWindow fitHeight icon="numericinput" initialWidth={350} initialX={-1}
                onClose={this.props.toggleNumericInput} scrollable title={LocaleUtils.tr("draw3d.numericinput")} >
                <div className="draw3d-numeric-input-body" role="body">
                    <table>
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("draw3d.position")}</td>
                                <td><NumberInput decimals={0} disabled={disabled} onChange={x => this.updatePosition(0, x)} value={pos[0]} /></td>
                                <td><NumberInput decimals={0} disabled={disabled} onChange={y => this.updatePosition(1, y)} value={pos[1]} /></td>
                                <td><NumberInput decimals={0} disabled={disabled} onChange={z => this.updatePosition(2, z)} value={pos[2]} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("draw3d.rotation")}</td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={x => this.updateRotation(0, x)} suffix="°" value={rot[0]} /></td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={y => this.updateRotation(1, y)} suffix="°" value={rot[1]} /></td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={z => this.updateRotation(2, z)} suffix="°" value={rot[2]} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("draw3d.thescale")}</td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={x => this.updateScale(0, x)} value={scale[0]} /></td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={y => this.updateScale(1, y)} value={scale[1]} /></td>
                                <td><NumberInput decimals={1} disabled={disabled} onChange={z => this.updateScale(2, z)} value={scale[2]} /></td>
                            </tr>
                            {size ? (
                                <tr>
                                    <td>{LocaleUtils.tr("draw3d.thesize")} [{unit}]</td>
                                    <td><NumberInput decimals={1} disabled={disabled} onChange={x => this.updateSize(0, x)} value={size[0]} /></td>
                                    <td><NumberInput decimals={1} disabled={disabled} onChange={y => this.updateSize(1, y)} value={size[1]} /></td>
                                    <td><NumberInput decimals={1} disabled={disabled} onChange={z => this.updateSize(2, z)} value={size[2]} /></td>
                                </tr>
                            ) : (
                                <tr>
                                    <td className="draw3d-numeric-input-comment" colSpan="4"><i>{LocaleUtils.tr("draw3d.sizeunavailable")}</i></td>
                                </tr>
                            )}
                            {size ? (
                                <tr>
                                    <td />
                                    <td><ButtonBar active={this.state.anchors[0]} buttons={hanchors} onClick={x => this.setAnchor(0, x)} /></td>
                                    <td><ButtonBar active={this.state.anchors[1]} buttons={hanchors} onClick={y => this.setAnchor(0, y)} /></td>
                                    <td><ButtonBar active={this.state.anchors[2]} buttons={vanchors} onClick={z => this.setAnchor(0, z)} /></td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </ResizeableWindow>
        );
        return ReactDOM.createPortal(contents, this.el);
    }
    updateStateFromObject = () => {
        if (this.props.selectedObject) {
            // Temporarily remove rotation and compute bbox
            const originalRotation = this.props.selectedObject.rotation.clone();
            this.props.selectedObject.rotation.set(0, 0, 0);
            this.props.selectedObject.updateMatrixWorld(true);
            const bbox = new Box3().setFromObject(this.props.selectedObject);
            const size = [
                bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z
            ];
            this.props.selectedObject.rotation.copy(originalRotation);
            this.props.selectedObject.updateMatrixWorld(true);

            this.setState({
                pos: this.props.selectedObject.position.toArray(),
                rot: this.props.selectedObject.rotation.toArray().slice(0, 3).map(x => x / Math.PI * 180),
                scale: this.props.selectedObject.scale.toArray(),
                size: size
            });
        } else {
            this.setState({
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                scale: [1, 1, 1],
                size: null
            });
        }
    };
    updatePosition = (idx, value) => {
        const newPos = [...this.state.pos];
        newPos[idx] = value;
        this.props.selectedObject.position.set(...newPos);
        this.update();
    };
    updateRotation = (idx, value) => {
        const newRot = [...this.state.rot];
        newRot[idx] = value;
        this.props.selectedObject.rotation.set(
            ...newRot.map(x => x / 180 * Math.PI),
            this.props.selectedObject.rotation.order
        );
        this.update();
    };
    updateScale = (idx, value) => {
        const newScale = [...this.state.scale];
        newScale[idx] = value;
        this.props.selectedObject.scale.set(...newScale);
        this.update();
    };
    updateSize = (idx, value) => {
        const scaleDiff = value / this.state.size[idx];
        const newScale = [...this.state.scale];
        newScale[idx] = newScale[idx] * scaleDiff;
        // Offset for anchor
        const newPos = [...this.state.pos];
        if (this.state.anchors[idx] === 'begin') {
            newPos[idx] += 0.5 * (value - this.state.size[idx]);
        } else if (this.state.anchors[idx] === 'end') {
            newPos[idx] -= 0.5 * (value - this.state.size[idx]);
        }
        this.props.selectedObject.scale.set(...newScale);
        this.props.selectedObject.position.set(...newPos);
        this.update();
    };
    setAnchor = (idx, value) => {
        this.setState(state => ({
            anchors: [...state.anchors.slice(0, idx), value, ...state.anchors.slice(idx + 1)]
        }));
    };
    update = () => {
        this.props.selectedObject.updateMatrixWorld();
        this.props.transformControls.getHelper().updateMatrixWorld();
        this.updateStateFromObject();
        this.props.sceneContext.scene.notifyChange();
    };
}


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

import LocaleUtils from '../../../utils/LocaleUtils';
import ResizeableWindow from '../../ResizeableWindow';
import NumberInput from '../../widgets/NumberInput';


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
        scale: [1, 1, 1]
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
        const disabled = !this.props.selectedObject;
        const contents = (
            <ResizeableWindow fitHeight icon="numericinput" initialWidth={300} initialX={-1}
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
                        </tbody>
                    </table>
                </div>
            </ResizeableWindow>
        );
        return ReactDOM.createPortal(contents, this.el);
    }
    updateStateFromObject = () => {
        if (this.props.selectedObject) {
            this.setState({
                pos: this.props.selectedObject.position.toArray(),
                rot: this.props.selectedObject.rotation.toArray().slice(0, 3).map(x => x / Math.PI * 180),
                scale: this.props.selectedObject.scale.toArray()
            });
        } else {
            this.setState({
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                scale: [1, 1, 1]
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
    update = () => {
        this.props.selectedObject.updateMatrixWorld();
        this.props.transformControls.getHelper().updateMatrixWorld();
        this.updateStateFromObject();
        this.props.sceneContext.scene.notifyChange();
    };
}


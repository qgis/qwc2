/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import {default as GiroShape} from '@giro3d/giro3d/entities/Shape';
import PropTypes from 'prop-types';
import {BoxGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Mesh, MeshStandardMaterial, Shape, SphereGeometry} from 'three';

import LocaleUtils from '../../../utils/LocaleUtils';
import Icon from '../../Icon';
import ColorButton from '../../widgets/ColorButton';
import NumberInput from '../../widgets/NumberInput';


export default class CreateTool3D extends React.Component {
    static propTypes = {
        baseSize: PropTypes.number,
        baseSizeChanged: PropTypes.func,
        color: PropTypes.array,
        colorChanged: PropTypes.func,
        drawGroupId: PropTypes.string,
        geomType: PropTypes.string,
        objectCreated: PropTypes.func,
        sceneContext: PropTypes.object
    };
    componentDidMount() {
        this.drawCursor = new GiroShape({
            showVertices: true
        });
        this.props.sceneContext.addSceneObject("__drawCursor", this.drawCursor);
        const renderer = this.props.sceneContext.scene.renderer;
        renderer.domElement.addEventListener("pointermove", this.moveDrawCursor);
        renderer.domElement.addEventListener("pointerdown", this.drawShapeOnRelease);
    }
    componentWillUnmount() {
        this.props.sceneContext.removeSceneObject("__drawCursor");
        const renderer = this.props.sceneContext.scene.renderer;
        renderer.domElement.removeEventListener("pointermove", this.moveDrawCursor);
        renderer.domElement.removeEventListener("pointerdown", this.drawShapeOnRelease);
    }
    render() {
        return (
            <div className="redlining-controlsbar">
                <span>
                    <Icon className="redlining-control-icon" icon="pen" size="large" />
                    <ColorButton alpha={false} color={this.props.color} onColorChanged={this.props.colorChanged} />
                </span>
                <span>
                    <span>{LocaleUtils.tr("redlining.size")}:&nbsp;</span>
                    <NumberInput max={99} min={1} mobile
                        onChange={this.props.baseSizeChanged}
                        value={this.props.baseSize}/>
                </span>
            </div>
        );
    }
    moveDrawCursor = (ev) => {
        const rect = ev.target.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        const intersection = this.props.sceneContext.getSceneIntersection(x, y);
        if (intersection) {
            const p = intersection.point;
            this.drawCursor.setPoints([p]);
        } else {
            this.drawCursor.setPoints([]);
        }
        this.props.sceneContext.scene.notifyChange();
    };
    drawShapeOnRelease = (ev) => {
        if (ev.button === 0) {
            const renderer = this.props.sceneContext.scene.renderer;
            renderer.domElement.addEventListener("pointerup", this.drawShape, {once: true});
            renderer.domElement.addEventListener("pointermove", () => {
                renderer.domElement.removeEventListener("pointerup", this.drawShape);
            });
        }
    };
    drawShape = () => {
        const drawGroup = this.props.sceneContext.getSceneObject(this.props.drawGroupId);
        if (this.drawCursor.points.length === 0 || !drawGroup) {
            return;
        }
        let geometry = null;
        const s = this.props.baseSize;
        if (this.props.geomType === "Cuboid") {
            geometry = new BoxGeometry( s, s, s );
        } else if (this.props.geomType === "Wedge") {
            const shape = new Shape();
            shape.moveTo(-0.5 * s, -0.5 * s);
            shape.lineTo(0.5 * s, -0.5 * s);
            shape.lineTo(0.5 * s, 0.5 * s);
            shape.lineTo(-0.5 * s, -0.5 * s);
            geometry = new ExtrudeGeometry(shape, {depth: s});
        } else if (this.props.geomType === "Cylinder") {
            geometry = new CylinderGeometry( 0.5 * s, 0.5 * s, s );
        } else if (this.props.geomType === "Pyramid") {
            geometry = new ConeGeometry( 0.5 * s * Math.sqrt(2), s, 4, 1, false, Math.PI / 4);
        } else if (this.props.geomType === "Sphere") {
            geometry = new SphereGeometry( 0.5 * s );
        } else if (this.props.geomType === "Cone") {
            geometry = new ConeGeometry( 0.5 * s, s );
        }
        if (geometry) {
            geometry.rotateX(Math.PI / 2); // Z-up
            const material = new MeshStandardMaterial({color: new Color(...this.props.color.map(c => c / 255))});
            const mesh = new Mesh( geometry, material);
            drawGroup.add(mesh);
            mesh.position.copy(this.drawCursor.points[0]);
            mesh.position.z += 0.5 * s;
            mesh.updateMatrixWorld();
            this.props.sceneContext.scene.notifyChange();
            this.props.objectCreated(mesh);
        }
    };
}

/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {
    Color, CubeCamera, DoubleSide, HalfFloatType, LinearFilter,
    Mesh, MeshStandardMaterial, ShaderMaterial, SphereGeometry,
    Vector3, WebGLCubeRenderTarget
} from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls';

import SideBar from '../../components/SideBar';
import ColorButton from '../../components/widgets/ColorButton';
import NumberInput from '../../components/widgets/NumberInput';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/Viewshed3D.css';


const DISTANCE_MATERIAL_SHADERS = {
    vertex: `
        varying vec3 vWorldPos;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position,1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }`,
    fragment: `
        uniform vec3 observerPosition;
        uniform vec2 maxDistance;
        varying vec3 vWorldPos;
        void main() {
            float d = length(vWorldPos - observerPosition);
            float k = clamp(d / maxDistance.x, 0.0, 1.0);
            gl_FragColor = vec4(k, k, k, 1.0);
        }`
};

/**
 * Compute 3D viewsheds.
 */
export default class Viewshed3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        maxDistance: 500,
        cubeTextureSize: 2048,
        observerPos: {x: 0, y: 0, z: 0},
        visibleColor: [51, 255, 51],
        occludedColor: [255, 51, 51],
        gizmoVisible: true
    };
    constructor(props) {
        super(props);
        this.recomputing = false;
        this.visibleColor = new Vector3().fromArray(this.state.visibleColor);
        this.occludedColor = new Vector3().fromArray(this.state.occludedColor);
        this.maxDistance = [this.state.maxDistance, 0];
    }
    componentDidUpdate(prevProps, prevState) {
        if (
            this.cubeCamera && (
                this.state.maxDistance !== prevState.maxDistance ||
                this.state.visibleColor !== prevState.visibleColor ||
                this.state.occludedColor !== prevState.occludedColor ||
                this.state.gizmoVisible !== prevState.gizmoVisible
            )
        ) {
            if (this.state.maxDistance !== prevState.maxDistance) {
                for (const camera of this.cubeCamera.children) {
                    camera.far = this.state.maxDistance;
                    camera.updateProjectionMatrix();
                }
            }
            this.transformControls.getHelper().visible = this.state.gizmoVisible;
            this.visibleColor.fromArray(this.state.visibleColor);
            this.occludedColor.fromArray(this.state.occludedColor);
            this.maxDistance[0] = this.state.maxDistance;
            this.recompute();
        }
    }
    render() {
        return (
            <SideBar icon="eye"
                id="Viewshed3D" onHide={this.onHide} onShow={this.onShow}
                title={LocaleUtils.tr("appmenu.items.Viewshed3D")} width="20em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody() {
        const units = CoordinatesUtils.getUnits(this.props.sceneContext.mapCrs);
        return (
            <div className="viewshed3d-body">
                <table className="viewshed3d-optionstable">
                    <tbody>
                        <tr>
                            <td colSpan="2">{LocaleUtils.tr("viewshed3d.observerpos")}</td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                                <div className="viewshed3d-posinputs">
                                    <NumberInput onChange={x => this.updateObserverPos({x})} value={this.state.observerPos.x}/>
                                    <NumberInput onChange={y => this.updateObserverPos({y})} value={this.state.observerPos.y}/>
                                    <NumberInput onChange={z => this.updateObserverPos({z})} value={this.state.observerPos.z} />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("viewshed3d.visiblecolor")}</td>
                            <td><ColorButton alpha={false} color={this.state.visibleColor} onColorChanged={(color) => this.setState({visibleColor: color})} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("viewshed3d.occludedcolor")}</td>
                            <td><ColorButton alpha={false} color={this.state.occludedColor} onColorChanged={(color) => this.setState({occludedColor: color})} /></td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("viewshed3d.maxDistance")}</td>
                            <td><NumberInput min={10} onChange={d => this.setState({maxDistance: d})} suffix={" " + units} value={this.state.maxDistance} /></td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                                <label>
                                    <input checked={this.state.gizmoVisible} onChange={ev => this.setState({gizmoVisible: ev.target.checked})} type="checkbox" />
                                    {' '}{LocaleUtils.tr("viewshed3d.showgizmo")}
                                </label></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
    onShow = () => {
        this.overriddenMaterials = [];

        const scene = this.props.sceneContext.scene;
        const camera = this.props.sceneContext.scene.view.camera;
        const renderer = this.props.sceneContext.scene.renderer;

        this.props.sceneContext.addObjectAddedListener(this.overrideMaterial);

        // Observer sphere
        let sceneTarget;
        const intersection = this.props.sceneContext.getSceneIntersection(0, 0);
        if (intersection) {
            sceneTarget = intersection.point;
        } else {
            sceneTarget = this.props.sceneContext.scene.view.controls.target.clone();
            sceneTarget.z = this.props.sceneContext.getTerrainHeightFromMap([
                sceneTarget.x, sceneTarget.y
            ]) ?? 0;
        }
        sceneTarget.z += 10;
        this.setState({observerPos: {x: sceneTarget.x, y: sceneTarget.y, z: sceneTarget.z}});

        this.observerMesh = new Mesh(new SphereGeometry(1), new MeshStandardMaterial({color: new Color(0x0000ff)}));
        this.observerMesh.position.copy(sceneTarget);
        this.observerMesh.updateMatrixWorld(true);
        scene.add(this.observerMesh);

        // Cube camera
        this.cubemapTarget = new WebGLCubeRenderTarget(
            this.state.cubeTextureSize,
            {
                type: HalfFloatType,
                generateMipmaps: false,
                minFilter: LinearFilter,
                magFilter: LinearFilter
            }
        );
        this.cubeCamera = new CubeCamera(0.1, this.state.maxDistance, this.cubemapTarget);
        scene.add(this.cubeCamera);

        // Materials
        this.distanceMaterial = new ShaderMaterial({
            uniforms: {
                observerPosition: {value: this.observerMesh.position},
                maxDistance: {value: this.maxDistance}
            },
            vertexShader: DISTANCE_MATERIAL_SHADERS.vertex,
            fragmentShader: DISTANCE_MATERIAL_SHADERS.fragment
        });
        this.distanceMaterial.side = DoubleSide;

        // Observer sphere controls
        this.transformControls = new TransformControls(camera, renderer.domElement);
        this.transformControls.setMode('translate');
        this.transformControls.addEventListener('dragging-changed', this.onControlDrag);
        this.transformControls.addEventListener('objectChange', this.onControlChange);
        this.transformControls.addEventListener('change', this.onControlChange);
        this.transformControls.attach(this.observerMesh);
        this.transformControls.getHelper().updateMatrixWorld();
        scene.add(this.transformControls.getHelper());
        this.props.sceneContext.eventDispatcher.addEventListener('cameraChanged', this.updateTransformHelper);

        this.props.sceneContext.scene.notifyChange();
    };
    onHide = () => {
        this.props.sceneContext.removeObjectAddedListener(this.overrideMaterial);

        this.transformControls.removeEventListener('dragging-changed', this.onControlDrag);
        this.transformControls.removeEventListener('objectChange', this.onControlChange);
        this.transformControls.removeEventListener('change', this.onControlChange);
        this.props.sceneContext.eventDispatcher.removeEventListener('cameraChanged', this.updateTransformHelper);
        this.overriddenMaterials.forEach(material => {
            material.onBeforeCompile = material.userData.originalOnBeforeCompile;
            delete material.userData.originalOnBeforeCompile;
            material.needsUpdate = true;
        });
        this.overriddenMaterials = [];
        this.transformControls.detach();
        this.props.sceneContext.scene.remove(this.cubeCamera);
        this.props.sceneContext.scene.remove(this.transformControls.getHelper());
        this.props.sceneContext.scene.remove(this.observerMesh);

        this.cubeCamera = null;
        this.cubemapTarget = null;
        this.transformControls = null;
        this.observerMesh = null;
    };
    updateObserverPos = (diff) => {
        this.setState(state => {
            const newPos = {...state.observerPos, ...diff};
            if (diff.z !== undefined) {
                newPos.z = Math.max(newPos.z, this.props.sceneContext.getTerrainHeightFromMap([newPos.x, newPos.y]) ?? 0);
            }
            if (this.observerMesh) {
                this.observerMesh.position.setX(newPos.x);
                this.observerMesh.position.setY(newPos.y);
                this.observerMesh.position.setZ(newPos.z);
                this.observerMesh.updateMatrixWorld(true);
                this.transformControls.update();
                this.transformControls.getHelper().updateMatrixWorld();
                this.props.sceneContext.scene.notifyChange(this.observerMesh);
                this.recompute();
            }
            return {observerPos: newPos};
        });
    };
    updateTransformHelper = () => {
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange();
    };
    onControlDrag = (event) => {
        this.props.sceneContext.scene.view.controls.enabled = !event.value;
    };
    onControlChange = () => {
        const p = this.observerMesh.position;
        p.z = Math.max(p.z, this.props.sceneContext.getTerrainHeightFromMap([p.x, p.y]) ?? 0);
        this.setState({observerPos: {x: p.x, y: p.y, z: p.z}});
        this.observerMesh.updateMatrixWorld(true);
        this.transformControls.getHelper().updateMatrixWorld();
        this.props.sceneContext.scene.notifyChange(this.observerMesh);
        this.props.sceneContext.scene.notifyChange(this.transformControls.getHelper());
        this.recompute();
    };
    recompute = () => {
        if (this.recomputing) {
            return;
        }
        this.recomputing = true;
        const renderer = this.props.sceneContext.scene.renderer;
        const scene = this.props.sceneContext.scene.scene;
        this.cubeCamera.position.copy(this.observerMesh.position);
        this.cubeCamera.updateMatrixWorld(true);

        const prevOverrideMaterial = scene.overrideMaterial;
        scene.overrideMaterial = this.distanceMaterial;
        this.observerMesh.visible = false;
        this.transformControls.getHelper().visible = false;

        this.cubeCamera.renderTarget.clear(renderer, true, true, true);
        this.cubeCamera.update(renderer, scene);

        this.observerMesh.visible = true;
        this.transformControls.getHelper().visible = this.state.gizmoVisible;
        scene.overrideMaterial = prevOverrideMaterial;

        this.overrideMaterial(scene);
        this.recomputing = false;
        this.props.sceneContext.scene.notifyChange();
    };
    overrideMaterial = (obj) => {
        if (obj === this.transformControls.getHelper() || obj === this.observerMesh) {
            return;
        }
        if (obj.userData?.parentEntity === this.props.sceneContext.getMap()) {
            // Don't override terrain tiles material
            return;
        }
        obj.children?.forEach?.(this.overrideMaterial);
        if (obj.material && obj.material.onBeforeCompile !== this.injectShader) {
            obj.material.userData.originalOnBeforeCompile = obj.material.onBeforeCompile;
            obj.material.onBeforeCompile = this.injectShader;
            obj.material.needsUpdate = true;
            this.overriddenMaterials.push(obj.material);
        }
    };
    injectShader = (shader) => {
        shader.uniforms.visibilityMap = { value: this.cubemapTarget.texture };
        shader.uniforms.observerPos = { value: this.observerMesh.position };
        shader.uniforms.maxDist = { value: this.maxDistance };
        shader.uniforms.visibleColor = { value: this.visibleColor };
        shader.uniforms.occludedColor = { value: this.occludedColor };

        shader.vertexShader =
            'varying vec3 vVisWorld;\n' +
            shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>

            vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
            vVisWorld = worldPos.xyz;
            `
        );

        shader.fragmentShader =
            'varying vec3 vVisWorld;\n' +
            'uniform samplerCube visibilityMap;\n' +
            'uniform vec3 observerPos;\n' +
            'uniform vec2 maxDist;\n' +
            'uniform vec3 visibleColor;\n' +
            'uniform vec3 occludedColor;\n' +
            shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            vec3 dir = vVisWorld - observerPos;
            float dist = length(dir);
            vec3 ray = normalize(dir);

            float enc = textureCube(visibilityMap, ray).r;
            float stored = enc * maxDist.x;

            bool visible = dist <= stored + 0.5;
            vec3 tint = visible ? visibleColor : occludedColor;

            gl_FragColor.rgb = mix(gl_FragColor.rgb, tint / 255.0, 0.8);

            #include <dithering_fragment>
            `
        );
    };
}

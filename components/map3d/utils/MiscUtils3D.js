/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {BufferGeometry, Group, Mesh, Vector2, Vector3} from 'three';
import {MeshLine, MeshLineMaterial} from 'three.meshline';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {CSS2DObject} from "three/addons/renderers/CSS2DRenderer";
import {v4 as uuidv4} from 'uuid';

import ConfigUtils from '../../../utils/ConfigUtils';


export function createLabelObject(text, pos, sceneContext, zoffset, yoffset = 0) {
    const labelEl = document.createElement("span");
    labelEl.className = "map3d-object-label";
    labelEl.textContent = text;
    const labelObject = new CSS2DObject(labelEl);
    labelObject.position.set(pos.x, pos.y + yoffset, pos.z + zoffset);
    labelObject.updateMatrixWorld();
    // Leader line
    const linegeom = new MeshLine();
    linegeom.setGeometry(new BufferGeometry().setFromPoints([new Vector3(0, -yoffset, -zoffset), new Vector3(0, 0, 0)]));
    const resolution = new Vector2(sceneContext.scene.view.width, sceneContext.scene.view.height);
    const linemat = new MeshLineMaterial({color: 0x3988C4, resolution: resolution, lineWidth: 2, sizeAttenuation: 0});
    const linemesh = new Mesh(linegeom, linemat);
    labelObject.add(linemesh);
    linemesh.updateMatrixWorld();
    labelObject.userData.sceneResizeCallback = ({width, height}) => {
        linemat.resolution.set(width, height);
    };
    sceneContext.scene.view.addEventListener('view-resized', labelObject.userData.sceneResizeCallback);
    return labelObject;
}

export function updateObjectLabel(sceneObject, sceneContext) {
    let labelObject = sceneObject.children.find(child => child.isCSS2DObject);
    if (sceneObject.userData.label) {
        if (!labelObject) {
            labelObject = createLabelObject(sceneObject.userData.label, new Vector3(0, 0, 0), sceneContext, sceneObject.userData.labelOffset ?? 80);
            sceneObject.add(labelObject);
            sceneObject.updateMatrixWorld();
            labelObject.userData.removeCallback = () => {
                // Explicitly remove label DOM element
                labelObject.element.parentNode.removeChild(labelObject.element);
            };
            sceneObject.addEventListener('removed', labelObject.userData.removeCallback);
        } else {
            labelObject.element.textContent = sceneObject.userData.label;
        }
    } else if (labelObject) {
        sceneObject.removeEventListener('removed', labelObject.userData.removeCallback);
        sceneContext.scene.view.removeEventListener('view-resized', labelObject.userData.sceneResizeCallback);
        // Remove leaderline first, as the remove trigger of the CSS2DObject assumes children are CSS2DObjects as well
        labelObject.children[0].removeFromParent();
        labelObject.removeFromParent();
    }
}

export function importGltf(dataOrUrl, name, sceneContext, drawGroup = true) {
    const loader = new GLTFLoader();
    const processor = (gltf) => {
        // GLTF is Y-UP, we need Z-UP
        gltf.scene.rotation.x = Math.PI / 2;
        gltf.scene.updateMatrixWorld();

        const objectId = uuidv4();
        const options = {
            drawGroup: drawGroup,
            layertree: true,
            title: name
        };
        const group = new Group();
        group.add(gltf.scene);
        gltf.scene.traverse(c => {
            if (c.geometry) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
            if (c.userData.label) {
                updateObjectLabel(c, sceneContext);
            }
        });
        sceneContext.addSceneObject(objectId, group, options);
    };
    if (typeof dataOrUrl === 'string') {
        loader.load(dataOrUrl, processor, () => {}, (err) => {
            /* eslint-disable-next-line */
            console.warn(err);
        });
    } else {
        loader.parse(dataOrUrl, ConfigUtils.getAssetsPath(), processor, (err) => {
            /* eslint-disable-next-line */
            console.warn(err);
        });
    }
}

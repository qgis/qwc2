/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {CSS2DObject} from "three/addons/renderers/CSS2DRenderer";
import {v4 as uuidv4} from 'uuid';

import ConfigUtils from '../../../utils/ConfigUtils';


export function updateObjectLabel(sceneObject) {
    let labelObject = sceneObject.children.find(child => child.isCSS2DObject);
    if (sceneObject.userData.label) {
        if (!labelObject) {
            const labelEl = document.createElement("span");
            labelEl.className = "map3d-object-label";
            labelObject = new CSS2DObject(labelEl);
            labelObject.updateMatrixWorld();
            sceneObject.add(labelObject);
            labelObject.userData.removeCallback = () => {
                // Explicitly remove label DOM element
                labelEl.parentNode.removeChild(labelEl);
            };
            sceneObject.addEventListener('removed', labelObject.userData.removeCallback);
            sceneObject.updateMatrixWorld();
        }
        labelObject.element.textContent = sceneObject.userData.label;
    } else if (labelObject) {
        sceneObject.removeEventListener('removed', labelObject.userData.removeCallback);
        sceneObject.remove(labelObject);
    }
}

export function importGltf(dataOrUrl, name, sceneContext) {
    const loader = new GLTFLoader();
    const processor = (gltf) => {
        // GLTF is Y-UP, we need Z-UP
        gltf.scene.rotation.x = Math.PI / 2;
        gltf.scene.updateMatrixWorld();

        const objectId = uuidv4();
        const options = {
            drawGroup: true,
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
                updateObjectLabel(c);
            }
        });
        sceneContext.addSceneObject(objectId, group, options);
    };
    if (typeof dataOrUrl === 'string') {
        loader.load(dataOrUrl, processor, (err) => {
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

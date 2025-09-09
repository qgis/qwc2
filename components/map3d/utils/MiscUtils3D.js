/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Box3, BufferGeometry, Mesh, Vector2, Vector3} from 'three';
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
            labelObject = createLabelObject(sceneObject.userData.label, new Vector3(0, 0, 0), sceneContext, sceneObject.userData.labelOffset ?? 50);
            sceneObject.add(labelObject);
            sceneObject.updateMatrixWorld();
            labelObject.userData.removeCallback = () => {
                // Explicitly remove label DOM element
                labelObject.element.parentNode?.removeChild?.(labelObject.element);
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

export function importGltf(dataOrUrl, name, sceneContext, options = {}) {
    const loader = new GLTFLoader();
    const processor = (gltf) => {
        // GLTF is Y-UP, we need Z-UP
        gltf.scene.rotation.x = Math.PI / 2;
        gltf.scene.updateMatrixWorld(true);

        const objectId = uuidv4();
        options = {
            layertree: true,
            title: name,
            ...options
        };
        gltf.scene.castShadow = true;
        gltf.scene.receiveShadow = true;
        gltf.scene.traverse(c => {
            if (c.geometry) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
            updateObjectLabel(c, sceneContext);
        });

        // Shift root position to center of object
        gltf.scene.updateMatrixWorld(true);

        const box = new Box3().setFromObject(gltf.scene);
        const centerWorld = box.getCenter(new Vector3());
        centerWorld.z = box.min.z;
        const centerLocal = gltf.scene.worldToLocal(centerWorld.clone());
        gltf.scene.position.add(centerWorld);

        // Offset children back so the world positions remain unchanged
        gltf.scene.children.forEach(child => {
            child.position.sub(centerLocal);
        });
        gltf.scene.updateMatrixWorld(true);

        sceneContext.addSceneObject(objectId, gltf.scene, options);
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

export class TileMeshHelper {
    constructor(object) {
        this.object = object;
        const {meshFeatures, structuralMetadata} = object.userData;
        if (meshFeatures && structuralMetadata) {
            // Get featureId via featureId attribute
            const featureSetIndex = 0; // usually 0 unless multiple feature sets
            this.featureSet = meshFeatures.featureIds[featureSetIndex];
            this.featureIdAttr = object.geometry.getAttribute(`_feature_id_${this.featureSet.attribute}`);
        } else if ('_batchid' in object.geometry.attributes) {
            // Get featureId via batchId attribute
            this.featureSet = null;
            this.featureIdAttr = object.geometry.getAttribute('_batchid');
        } else {
            /* eslint-disable-next-line */
            console.warn("Cannot determine tile mesh feature index attribute")
            this.featureIdAttr = null;
        }
        this.tileObject = object;
        while (this.tileObject.parent && !this.tileObject.parent.isTilesGroup) {
            this.tileObject = this.tileObject.parent;
        }
        this.propertiesCache = {};
    }
    isValid() {
        return this.featureIdAttr !== null;
    }
    getFeatureId(face) {
        return this.featureIdAttr ? this.featureIdAttr.getX(face.a) : null;
    }
    getFeatureIdAttr() {
        return this.featureIdAttr;
    }
    getFeatureIds() {
        const featureIds = new Set();
        for (let i = 0; i < this.featureIdAttr.count; i++) {
            featureIds.add(this.featureIdAttr.getX(i));
        }
        return featureIds;
    }
    getFeatureProperties(featureId) {
        if (featureId in this.propertiesCache) {
            return this.propertiesCache[featureId];
        } else if (this.object.userData.structuralMetadata) {
            this.propertiesCache[featureId] = this.object.userData.structuralMetadata.getPropertyTableData([this.featureSet.propertyTable], [featureId])[0];
        } else if (this.tileObject.batchTable) {
            this.propertiesCache[featureId] = this.tileObject.batchTable.getDataFromId(featureId);
        } else {
            this.propertiesCache[featureId] = {};
        }
        return this.propertiesCache[featureId];
    }
    getTileUserData() {
        return this.tileObject.userData;
    }
    forEachFeatureTriangle(featureId, callback) {
        if (!this.featureIdAttr) {
            return;
        } else if (this.object.geometry.index) {
            // For indexed geometries, index attribute contains a sequence of triangle index triplets
            const indices = this.object.geometry.index.array;
            for (let tri = 0; tri < indices.length; tri += 3) {
                const i0 = indices[tri];
                if (this.featureIdAttr.getX(i0) === featureId) {
                    const i1 = indices[tri + 1];
                    const i2 = indices[tri + 2];
                    callback(i0, i1, i2);
                }
            }
        } else {
            // For non-index geometries, the id attribute contains a sequence of triangle vertex indices
            for (let tri = 0; tri < this.featureIdAttr.count; tri += 3) {
                if (this.featureIdAttr.getX(tri) === featureId) {
                    callback(tri, tri + 1, tri + 2);
                }
            }
        }
    }
}

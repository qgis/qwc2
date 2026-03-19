/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Box3, BufferGeometry, Matrix3, Matrix4, Mesh, Vector2, Vector3} from 'three';
import {MeshLine, MeshLineMaterial} from 'three.meshline';
import {CSS2DObject} from "three/addons/renderers/CSS2DRenderer";

import convexHull from '../../../utils/QuickHull2D';


export function createLabelObject(text, pos, sceneContext, zoffset, yoffset = 0) {
    const labelEl = document.createElement("span");
    labelEl.className = "map3d-object-label";
    if (text.startsWith("<")) {
        labelEl.innerHTML = text;
    } else {
        labelEl.textContent = text;
    }
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

export function computeOBBXY(mesh) {
    // Idea:
    // - compute convex hull of 2D points (XY plane)
    // - for each edge of the hull, compute box oriented to that edge, and check which results in minimum box area

    const pos = mesh.geometry.getAttribute('position');
    const n = pos.count;
    if (n === 0) {
        return null;
    }

    // Collect 2D points
    const pointsxy = new Array(n);
    let zmin = Infinity;
    let zmax = -Infinity;

    for (let i = 0; i < n; i++) {
        pointsxy[i] = [pos.getX(i), pos.getY(i)];
        zmin = Math.min(zmin, pos.getZ(i));
        zmax = Math.max(zmax, pos.getZ(i));
    }

    // Compute convex hull
    const hull = convexHull(pointsxy);
    if (hull.length < 3) {
        return null;
    }

    // Edge sweep
    let bestArea = Infinity;
    let best = null;

    for (let i = 0; i < hull.length; i++) {
        const p0 = new Vector2(...hull[i]);
        const p1 = new Vector2(...hull[(i + 1) % hull.length]);

        const u = new Vector2().subVectors(p1, p0).normalize();
        const v = new Vector2(u.y, -u.x);

        let umin = Infinity;
        let umax = -Infinity;
        let vmin = Infinity;
        let vmax = -Infinity;

        for (let j = 0; j < hull.length; j++) {
            const p = new Vector2(...hull[j]);
            const pu = p.dot(u);
            const pv = p.dot(v);

            if (pu < umin) umin = pu;
            if (pu > umax) umax = pu;
            if (pv < vmin) vmin = pv;
            if (pv > vmax) vmax = pv;
        }

        const area = (umax - umin) * (vmax - vmin);

        if (area < bestArea) {
            bestArea = area;
            best = {u, v, umin, umax, vmin, vmax};
        }
    }

    const {u, v, umin, umax, vmin, vmax} = best;

    const center = new Vector3(
        u.x * (umin + umax) / 2 + v.x * (vmin + vmax) / 2,
        u.y * (umin + umax) / 2 + v.y * (vmin + vmax) / 2,
        (zmin + zmax) / 2
    ).applyMatrix4(mesh.matrixWorld);
    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
    return {
        center,
        axes: [
            new Vector3(u.x, u.y, 0).applyMatrix3(normalMatrix).normalize(),
            new Vector3(v.x, v.y, 0).applyMatrix3(normalMatrix).normalize(),
            new Vector3(0, 0, 1)
        ],
        halfSizes: new Vector3(
            (umax - umin) / 2 * Math.hypot(u.x * mesh.scale.x, u.y * mesh.scale.y),
            (vmax - vmin) / 2 * Math.hypot(v.x * mesh.scale.x, v.y * mesh.scale.y),
            (zmax - zmin) / 2 * mesh.scale.z
        )
    };
}

export class TileMeshHelper {
    constructor(object) {
        this.object = object;
        const {meshFeatures, structuralMetadata} = object.userData;
        if (meshFeatures && structuralMetadata) {
            // Get featureId via featureId attribute
            const featureSetIndex = 0; // usually 0 unless multiple feature sets
            const featureSet = meshFeatures.featureIds[featureSetIndex];
            this.propertyTable = featureSet.propertyTable;
            this.featureIdAttr = object.geometry.getAttribute(`_feature_id_${featureSet.attribute}`) || object.geometry.getAttribute(`_FEATURE_ID_${featureSet.attribute}`);
        } else if (structuralMetadata) {
            this.featureIdAttr = object.geometry.getAttribute(`_feature_id_0`) || object.geometry.getAttribute('_FEATURE_ID_0');
            this.propertyTable = 0;
        } else if ('_batchid' in object.geometry.attributes) {
            // Get featureId via batchId attribute
            this.propertyTable = null;
            this.featureIdAttr = object.geometry.getAttribute('_batchid');
        } else if ('_BATCHID' in object.geometry.attributes) {
            // Get featureId via batchId attribute
            this.propertyTable = null;
            this.featureIdAttr = object.geometry.getAttribute('_BATCHID');
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
    getWorldBBox() {
        if (this.object.isInstancedMesh) {
            const globalBox = new Box3();
            const tempBox = new Box3();
            const tempMatrix = new Matrix4();

            for (let i = 0; i < this.object.count; i++) {
                this.object.getMatrixAt(i, tempMatrix);

                tempBox.copy(this.object.geometry.boundingBox);
                tempBox.applyMatrix4(tempMatrix);
                globalBox.union(tempBox);
            }
            return globalBox.applyMatrix4(this.object.matrixWorld);
        } else {
            return this.object.geometry.boundingBox.clone().applyMatrix4(this.object.matrixWorld);
        }
    }
    getPickFeatureId(pick) {
        if (pick.instanceId) {
            return this.featureIdAttr ? this.featureIdAttr.getX(pick.instanceId) : pick.instanceId;
        } else {
            return this.featureIdAttr ? this.featureIdAttr.getX(pick.instanceId ?? pick.face.a) : null;
        }
    }
    getFeatureIdAttr() {
        return this.featureIdAttr;
    }
    getFeatureIds() {
        const featureIds = new Set();
        if (this.featureIdAttr) {
            for (let i = 0; i < this.featureIdAttr.count; i++) {
                featureIds.add(this.featureIdAttr.getX(i));
            }
        } else if (this.object.isInstancedMesh) {
            for (let i = 0; i < this.object.count; ++i) {
                featureIds.add(i);
            }
        }
        return featureIds;
    }
    getFeatureProperties(featureId) {
        if (featureId in this.propertiesCache) {
            return this.propertiesCache[featureId];
        } else if (this.object.userData.structuralMetadata) {
            this.propertiesCache[featureId] = this.object.userData.structuralMetadata.getPropertyTableData([this.propertyTable], [featureId])[0];
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
        if (this.object.isInstancedMesh) {
            const matrix = new Matrix4();
            this.object.getMatrixAt(featureId, matrix);
            const normalMatrix = new Matrix3().getNormalMatrix(matrix);
            if (this.object.geometry.index) {
                const indices = this.object.geometry.index.array;
                for (let tri = 0; tri < indices.length; tri += 3) {
                    const i0 = indices[tri];
                    const i1 = indices[tri + 1];
                    const i2 = indices[tri + 2];
                    callback(i0, i1, i2, matrix, normalMatrix);
                }
            } else {
                const position = this.object.geometry.getAttribute('position');
                for (let tri = 0; tri < position.length; tri += 3) {
                    callback(tri, tri + 1, tri + 2, matrix, normalMatrix);
                }
            }

        }
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
                    callback(i0, i1, i2, null, null);
                }
            }
        } else {
            // For non-index geometries, the id attribute contains a sequence of triangle vertex indices
            for (let tri = 0; tri < this.featureIdAttr.count; tri += 3) {
                if (this.featureIdAttr.getX(tri) === featureId) {
                    callback(tri, tri + 1, tri + 2, null, null);
                }
            }
        }
    }
    getPosition(idx, matrix = null) {
        const posAttr = this.object.geometry.attributes.position;
        const pos = new Vector3(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
        if (matrix) {
            pos.applyMatrix4(matrix);
        }
        return pos;
    }
    getNormal(idx, matrix = null) {
        const norAttr = this.object.geometry.attributes.normal;
        const pos = new Vector3(norAttr.getX(idx), norAttr.getY(idx), norAttr.getZ(idx));
        if (matrix) {
            pos.applyMatrix3(matrix).normalize();
        }
        return pos;
    }
}

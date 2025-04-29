/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from "lodash.isempty";
import parseCssColor from 'parse-css-color';
import {Float32BufferAttribute, Group, Vector3} from "three";
import {CSS2DObject} from "three/addons/renderers/CSS2DRenderer";


function createLabelObject(entry) {
    const labelEl = document.createElement("span");
    labelEl.innerText = entry.label;
    labelEl.className = "map3d-object-label";
    const label = new CSS2DObject(labelEl);
    label.position.copy(entry.pos);
    label.updateMatrixWorld();
    return label;
}

function batchColor(batchId, batchAttr, config) {
    if ((config.tilesetStyle?.[batchId]?.color ?? null) !== null) {
        const color = parseCssColor(config.tilesetStyle[batchId].color);
        return [...color.values.map(c => c / 255), color.alpha];
    } else if (batchAttr[config.colorAttr]) {
        const color = batchAttr[config.colorAttr];
        const alpha = config.alphaAttr ? batchAttr[config.alphaAttr] ?? 255 : 255;
        const r = ((color >> 16) & 0xff) / 255;
        const g = ((color >> 8) & 0xff) / 255;
        const b = (color & 0xff) / 255;
        return [r, g, b, alpha / 255];
    } else {
        return null;
    }
}

function batchLabel(batchId, batchAttr, config) {
    if ((config.tilesetStyle?.[batchId]?.label ?? null) !== null) {
        return config.tilesetStyle[batchId].label;
    } else if (config.labelAttr) {
        return batchAttr[config.labelAttr];
    } else {
        return null;
    }
}

const Tiles3DStyle = {
    handleModelLoad(group, config) {
        const batchColorCache = {};
        const batchLabelCache = {};
        const labels = {};
        const idAttr = config.idAttr ?? "id";

        group.traverse(c => {
            if (c.geometry) {
                const batchidxAttr = c.geometry.getAttribute( '_batchid' );
                const batchPosAttr = c.geometry.getAttribute('position');
                const rgbaColors = [];
                const rgbColors = [];
                let haveColor = false;
                let haveAlpha = false;

                batchidxAttr.array.forEach((batchIdx, idx) => {
                    const batchAttr = group.batchTable.getDataFromId(batchIdx);
                    const batchId = String(batchAttr[idAttr]);

                    // Handle color
                    let color = batchColorCache[batchIdx];
                    if (color === undefined) {
                        color = batchColorCache[batchIdx] = batchColor(batchId, batchAttr, config);
                    }
                    if (color) {
                        haveColor = true;
                        haveAlpha |= color[3] < 1;
                        rgbaColors.push(...color);
                        rgbColors.push(...color.slice(0, 3));
                    } else {
                        rgbaColors.push(...[1, 1, 1, 1]);
                        rgbColors.push(...[1, 1, 1]);
                    }

                    // Handle label
                    let label = batchLabelCache[batchIdx];
                    if (label === undefined) {
                        label = batchLabelCache[batchIdx] = batchLabel(batchId, batchAttr, config);
                    }
                    if (label) {
                        const pos = batchPosAttr.array.slice(3 * idx, 3 * idx + 3);
                        let entry = labels[batchIdx];
                        if (!entry) {
                            entry = labels[batchIdx] = {
                                label: label,
                                pos: pos,
                                count: 1,
                                matrix: c.matrixWorld
                            };
                        } else {
                            entry.pos[0] += pos[0];
                            entry.pos[1] += pos[1];
                            entry.pos[2] = Math.max(
                                entry.pos[2], pos[2]
                            );
                            ++entry.count;
                        }
                    }
                });

                if (haveColor) {
                    if (haveAlpha) {
                        c.geometry.setAttribute('color', new Float32BufferAttribute(rgbaColors, 4));
                    } else {
                        // Discard alpha
                        const count = rgbaColors.length / 4;
                        const bufAttr = new Float32BufferAttribute(count * 3, 3);
                        for (let i = 0, j = 0; i < count; ++i) {
                            bufAttr.array[j++] = rgbaColors[4 * i];
                            bufAttr.array[j++] = rgbaColors[4 * i + 1];
                            bufAttr.array[j++] = rgbaColors[4 * i + 2];
                        }
                        c.geometry.setAttribute('color', bufAttr);
                    }
                    c.material.vertexColors = true;
                    c.material.transparent = haveAlpha;
                }
            }
        });

        if (!isEmpty(labels)) {
            const tileLabels = [];
            const labelObjects = new Group();
            Object.values(labels).forEach(entry => {
                const pos = new Vector3(
                    entry.pos[0] / entry.count,
                    entry.pos[1] / entry.count,
                    entry.pos[2] + 10
                ).applyMatrix4(entry.matrix);
                tileLabels.push({pos, label: entry.label});
                labelObjects.add(createLabelObject(tileLabels[tileLabels.length - 1]));
            });
            group.userData.tileLabels = tileLabels;
            group.add(labelObjects);
        }
    },
    handleTileVisibilityChange(group, visible) {
        // Re-add labels
        if (visible && group.userData.tileLabels) {
            const labelObjects = new Group();
            group.userData.tileLabels.forEach(entry => {
                labelObjects.add(createLabelObject(entry));
            });
            group.add(labelObjects);
        }
    }
};

export default Tiles3DStyle;

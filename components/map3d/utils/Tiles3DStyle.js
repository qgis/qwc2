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

import {createLabelObject} from "./MiscUtils3D";


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
        return {text: config.tilesetStyle[batchId].label, offset: config.tilesetStyle[batchId].labelOffset ?? 80};
    } else if (config.labelAttr) {
        return batchAttr[config.labelAttr];
    } else {
        return null;
    }
}

const Tiles3DStyle = {
    applyTileStyle(group, config, sceneContext) {
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
                if (!batchidxAttr) {
                    return;
                }

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
                                label: label.text,
                                labelOffset: label.offset,
                                pos: pos,
                                ymax: pos[1],
                                count: 1,
                                matrix: c.matrixWorld
                            };
                        } else {
                            entry.pos[0] += pos[0];
                            entry.pos[1] += pos[1];
                            entry.pos[2] += pos[2];
                            entry.ymax = Math.max(entry.ymax, pos[1]);
                            ++entry.count;
                        }
                    }
                });

                // NOTE: Also update color buffers if they were previously colored
                if (haveColor || group.userData.haveColor) {
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
                    group.userData.haveColor = haveColor;
                }
            }
        });

        // Clear previous labels
        if (group.userData.labelGroup) {
            group.remove(group.children.find(child => child.uuid === group.userData.labelGroup));
            // Explicitly remove label DOM elements
            Object.values(group.userData.tileLabels).forEach(entry => {
                entry.labelObject.element.parentNode.removeChild(entry.labelObject.element);
            });
            delete group.userData.tileLabels;
            delete group.userData.labelGroup;
        }
        // Add new labels
        if (!isEmpty(labels)) {
            const tileLabels = {};
            const labelObjects = new Group();
            Object.entries(labels).forEach(([batchId, entry]) => {
                const pos = new Vector3(
                    entry.pos[0] / entry.count,
                    entry.pos[1] / entry.count,
                    entry.pos[2] / entry.count
                ).applyMatrix4(entry.matrix);
                const maxpos = new Vector3(
                    entry.pos[0] / entry.count,
                    entry.ymax,
                    entry.pos[2] / entry.count
                ).applyMatrix4(entry.matrix);
                tileLabels[batchId] = {pos, label: entry.label, labelOffset: entry.labelOffset};
                tileLabels[batchId].labelObject = createLabelObject(entry.label, pos, sceneContext, 0, entry.labelOffset + (maxpos.y - pos.y));
                labelObjects.add(tileLabels[batchId].labelObject);
            });
            group.userData.tileLabels = tileLabels;
            group.userData.labelGroup = labelObjects.uuid;
            group.add(labelObjects);
        }
    }
};

export default Tiles3DStyle;

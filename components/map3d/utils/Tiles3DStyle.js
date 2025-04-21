import axios from "axios";
import isEmpty from "lodash.isempty";
import {Float32BufferAttribute, Group, Vector3} from "three";
import {CSS2DObject} from "three/addons/renderers/CSS2DRenderer";

import MiscUtils from "../../../utils/MiscUtils";


function applyDeclarativeStyle(group, config) {
    if (!config.colorAttr) {
        return;
    }
    const batchColorCache = {};
    const batchColor = (batchId) => {
        if (!batchColorCache[batchId]) {
            const batchAttr = group.batchTable.getDataFromId(batchId);
            const color = batchAttr[config.colorAttr] ?? 0xFFFFFF;
            const alpha = config.alphaAttr ? batchAttr[config.alphaAttr] ?? 255 : 255;
            const r = ((color >> 16) & 0xff) / 255;
            const g = ((color >> 8) & 0xff) / 255;
            const b = (color & 0xff) / 255;
            batchColorCache[batchId] = [r, g, b, alpha / 255];
        }
        return batchColorCache[batchId];
    };
    const withAlpha = !!config.alphaAttr;

    group.traverse(c => {
        if (c.geometry) {
            const batchidAttr = c.geometry.getAttribute( '_batchid' );
            const colors = [];
            batchidAttr.array.forEach(batchId => {
                const color = batchColor(batchId);
                colors.push(...color.slice(0, 3));
                if (withAlpha) {
                    colors.push(color[3]);
                }
            });
            c.geometry.setAttribute('color', new Float32BufferAttribute(colors, withAlpha ? 4 : 3));
            c.material.vertexColors = true;
            c.material.transparent = withAlpha;
        }
    });
}

function createLabelObject(entry) {
    const labelEl = document.createElement("span");
    labelEl.innerText = entry.label;
    labelEl.className = "map3d-tile-batch-label";
    const label = new CSS2DObject(labelEl);
    label.position.copy(entry.pos);
    label.updateMatrixWorld();
    return label;
}

function applyLabels(group, config) {
    const createLabels = (getLabel) => {
        const labelPositions = {};
        group.traverse(c => {
            if (c.geometry) {
                const batchidAttr = c.geometry.getAttribute( '_batchid' );
                const posAttr = c.geometry.getAttribute('position');
                batchidAttr.array.forEach((batchId, idx) => {
                    const label = getLabel(batchId);
                    if (label) {
                        const pos = posAttr.array.slice(3 * idx, 3 * idx + 3);
                        if (!labelPositions[batchId]) {
                            labelPositions[batchId] = {
                                label: label,
                                pos: pos,
                                count: 1,
                                matrix: c.matrixWorld
                            };
                        } else {
                            labelPositions[batchId].pos[0] += pos[0];
                            labelPositions[batchId].pos[1] += pos[1];
                            labelPositions[batchId].pos[2] = Math.max(
                                labelPositions[batchId].pos[2], pos[2]
                            );
                            ++labelPositions[batchId].count;
                        }
                    }
                });
            }
        });
        if (isEmpty(labelPositions)) {
            return;
        }
        const labels = [];
        const labelObjects = new Group();
        Object.values(labelPositions).forEach(entry => {
            const pos = new Vector3(
                entry.pos[0] / entry.count,
                entry.pos[1] / entry.count,
                entry.pos[2] + 10
            ).applyMatrix4(entry.matrix);
            labels.push({pos, label: entry.label});
            labelObjects.add(createLabelObject(labels[labels.length - 1]));
        });
        group.userData.tileLabels = labels;
        group.add(labelObjects);
    };

    if (config.labelFileUrl) {
        axios.get(MiscUtils.resolveAssetsPath(config.labelFileUrl)).then(response => {
            const labelMap = response.data;
            const batchLabelCache = {};
            const getLabel = (batchId) => {
                if (!batchLabelCache[batchId]) {
                    const idAttr = group.userData.batchIdAttr;
                    const objectId = group.batchTable.getDataFromId(batchId)[idAttr];
                    batchLabelCache[batchId] = labelMap[String(objectId)];
                }
                return batchLabelCache[batchId];
            };
            createLabels(getLabel);
        }).catch(() => {});
    } else if (config.labelAttr) {
        const batchLabelCache = {};
        const getLabel = (batchId) => {
            if (!batchLabelCache[batchId]) {
                batchLabelCache[batchId] = group.batchTable.getDataFromId(batchId)[config.labelAttr];
            }
            return batchLabelCache[batchId];
        };
        createLabels(getLabel);
    }
}

const Tiles3DStyle = {
    handleModelLoad(group, config) {
        applyDeclarativeStyle(group, config);
        applyLabels(group, config);
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

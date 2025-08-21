/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Parser as ExprParser} from 'expr-eval';
import isEmpty from "lodash.isempty";
import parseCssColor from 'parse-css-color';
import {Float32BufferAttribute, Group, Vector3} from "three";

import MiscUtils from '../../../utils/MiscUtils';
import {createLabelObject, TileMeshHelper} from "./MiscUtils3D";


const styleExpressionParser = new ExprParser();
styleExpressionParser.functions.color = (name, alpha = 1) => {
    const color = parseCssColor(name);
    return [...color.values.map(c => c / 255), alpha];
};
styleExpressionParser.functions.rgb = (r, g, b) => ([r / 255, g / 255, g / 255, 1]);
styleExpressionParser.functions.rgba = (r, g, b, a) => ([r / 255, g / 255, g / 255, a]);
styleExpressionParser.functions.hsl = (h, s, l) => ([...MiscUtils.hslToRgb(h, s, l), 1]);
styleExpressionParser.functions.hsla = (h, s, l, a) => ([...MiscUtils.hslToRgb(h, s, l), a]);


function featureColor(objectId, featureProperties, context) {
    if ((context.featureStyles?.[objectId]?.color ?? null) !== null) {
        const color = parseCssColor(context.featureStyles[objectId].color);
        return [...color.values.map(c => c / 255), color.alpha];
    } else if (context.colorExpressions.length) {
        try {
            for (let i = 0; i < context.colorExpressions.length; ++i) {
                const condition = context.colorExpressions[i][0].evaluate(featureProperties);
                if (condition) {
                    return context.colorExpressions[i][1].evaluate(featureProperties);
                }
            }
        } catch (e) {
            /* eslint-disable-next-line */
            console.warn("Failed to parse color expression: " + String(e));
        }
        return null;
    } else if (featureProperties[context.colorAttr]) {
        const color = featureProperties[context.colorAttr];
        const alpha = context.alphaAttr ? featureProperties[context.alphaAttr] ?? 255 : 255;
        const r = ((color >> 16) & 0xff) / 255;
        const g = ((color >> 8) & 0xff) / 255;
        const b = (color & 0xff) / 255;
        return [r, g, b, alpha / 255];
    } else {
        return null;
    }
}

function featureLabel(objectId, featureProperties, context) {
    if ((context.featureStyles?.[objectId]?.label ?? null) !== null) {
        return {text: context.featureStyles[objectId].label, offset: context.featureStyles[objectId].labelOffset ?? 80};
    } else if (context.labelAttr) {
        return featureProperties[context.labelAttr];
    } else {
        return null;
    }
}

const Tiles3DStyle = {
    applyTileStyle(group, config, sceneContext) {
        const featureColorCache = {};
        const featureLabelCache = {};
        const labels = {};
        const idAttr = config.idAttr ?? "id";

        const context = {
            colorExpressions: [],
            featureStyles: config.tilesetStyle?.featureStyles,
            colorAttr: config.colorAttr,
            alphaAttr: config.alphaAttr,
            labelAttr: config.labelAttr
        };
        let baseColor = [1, 1, 1, 1];
        let customBaseColor = false;
        if (config.baseColor) {
            const color = parseCssColor(config.baseColor);
            baseColor = [...color.values.map(x => x / 255), color.alpha];
            customBaseColor = true;
        }
        const colorRules = config.tilesetStyle?.color;
        const parseExpr = (expr) => {
            const cleanExpr = expr.replace(/\$\{(\w+)\}/g, '$1').replaceAll('===', '==').replaceAll('!==', '==');
            return styleExpressionParser.parse(cleanExpr);
        };
        if (colorRules?.conditions) {
            colorRules?.conditions.forEach(cond => {
                context.colorExpressions.push([
                    parseExpr(cond[0]), parseExpr(cond[1])
                ]);
            });
        } else if (typeof(colorRules) === "string") {
            context.colorExpressions.push([parseExpr("true"), parseExpr(colorRules)]);
        }

        group.traverse(c => {
            if (c.geometry) {
                const helper = new TileMeshHelper(c);
                const featureIdAttr = helper.getFeatureIdAttr();
                if (!featureIdAttr) {
                    return;
                }

                const posAttr = c.geometry.getAttribute('position');
                const rgbaColors = [];
                const rgbColors = [];
                let haveColor = customBaseColor;
                let haveAlpha = baseColor[3] < 1;

                for (let idx = 0; idx < featureIdAttr.count; ++idx) {
                    const featureId = featureIdAttr.getX(idx);
                    const featureProperties = helper.getFeatureProperties(featureId);
                    const objectId = String(featureProperties[idAttr]);

                    // Handle color
                    let color = featureColorCache[featureId];
                    if (color === undefined) {
                        color = featureColorCache[featureId] = featureColor(objectId, featureProperties, context);
                    }
                    if (color) {
                        haveColor = true;
                        haveAlpha |= color[3] < 1;
                        rgbaColors.push(...color);
                        rgbColors.push(...color.slice(0, 3));
                    } else {
                        rgbaColors.push(...baseColor);
                        rgbColors.push(...baseColor.slice(0, 3));
                    }

                    // Handle label
                    let label = featureLabelCache[featureId];
                    if (label === undefined) {
                        label = featureLabelCache[featureId] = featureLabel(objectId, featureProperties, context);
                    }
                    if (label) {
                        const pos = posAttr.array.slice(3 * idx, 3 * idx + 3);
                        let entry = labels[featureId];
                        if (!entry) {
                            entry = labels[featureId] = {
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
                }

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
            Object.entries(labels).forEach(([featureId, entry]) => {
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
                tileLabels[featureId] = {pos, label: entry.label, labelOffset: entry.labelOffset};
                tileLabels[featureId].labelObject = createLabelObject(entry.label, pos, sceneContext, 0, entry.labelOffset + (maxpos.y - pos.y));
                labelObjects.add(tileLabels[featureId].labelObject);
            });
            group.userData.tileLabels = tileLabels;
            group.userData.labelGroup = labelObjects.uuid;
            group.add(labelObjects);
        }
    }
};

export default Tiles3DStyle;

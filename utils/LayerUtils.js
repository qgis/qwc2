/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import uuid from 'uuid';
import url from 'url';
import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from './CoordinatesUtils';
import MapUtils from './MapUtils';
import {LayerRole} from '../actions/layers';

const LayerUtils = {
    restoreLayerParams(themeLayer, layerConfigs, permalinkLayers, externalLayers) {
        let exploded = LayerUtils.explodeLayers([themeLayer]);
        // Restore theme layer configuration
        for (const entry of exploded) {
            const layerConfig = layerConfigs.find(layer => layer.type === 'theme' && layer.name === entry.sublayer.name);
            if (layerConfig) {
                entry.sublayer.opacity = layerConfig.opacity;
                entry.sublayer.visibility = layerConfig.visibility || layerConfig.tristate;
                entry.sublayer.tristate = layerConfig.tristate;
            } else {
                entry.sublayer.visibility = false;
            }
        }
        // Create placeholders for external layers to be added in front
        let external = [];
        for (const layerConfig of layerConfigs) {
            if (layerConfig.type === 'separator') {
                // No point restoring separators
            } else if (layerConfig.type !== 'theme') {
                external = external.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers, layerConfig.id));
            }
        }
        exploded = [...external, ...exploded];
        LayerUtils.insertPermalinkLayers(exploded, permalinkLayers);
        const layers = LayerUtils.implodeLayers(exploded);
        LayerUtils.setGroupVisiblities(layers);
        return layers;
    },
    restoreOrderedLayerParams(themeLayer, layerConfigs, permalinkLayers, externalLayers) {
        const exploded = LayerUtils.explodeLayers([themeLayer]);
        let reordered = [];
        // Iterate over layer configs and reorder items accordingly, create external layer placeholders as neccessary
        for (const layerConfig of layerConfigs) {
            if (layerConfig.type === 'theme') {
                const entry = exploded.find(e => e.sublayer.name === layerConfig.name);
                if (entry) {
                    entry.sublayer.opacity = layerConfig.opacity;
                    entry.sublayer.visibility = layerConfig.visibility || layerConfig.tristate;
                    entry.sublayer.tristate = layerConfig.tristate;
                    reordered.push(entry);
                }
            } else if (layerConfig.type === 'separator') {
                reordered = reordered.concat(LayerUtils.createSeparatorLayer(layerConfig.name));
            } else {
                reordered = reordered.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers, layerConfig.id));
            }
        }
        LayerUtils.insertPermalinkLayers(reordered, permalinkLayers);
        const layers = LayerUtils.implodeLayers(reordered);
        LayerUtils.setGroupVisiblities(layers);
        return layers;
    },
    setGroupVisiblities(layers) {
        let parentVisible = false;
        let parentInvisible = false;
        for (const layer of layers) {
            if (!isEmpty(layer.sublayers)) {
                layer.visibility = LayerUtils.setGroupVisiblities(layer.sublayers);
            }
            parentInvisible = parentInvisible || layer.tristate;
            delete layer.tristate;
            parentVisible = parentVisible || layer.visibility;
        }
        return parentVisible && !parentInvisible;
    },
    createSeparatorLayer(title) {
        return LayerUtils.explodeLayers([{
            type: "separator",
            title: title,
            role: LayerRole.USERLAYER,
            uuid: uuid.v4(),
            id: uuid.v4()
        }]);
    },
    createExternalLayerPlaceholder(layerConfig, externalLayers, id) {
        const key = layerConfig.type + ":" + layerConfig.url;
        (externalLayers[key] = externalLayers[key] || []).push({
            id: id,
            name: layerConfig.name,
            opacity: layerConfig.opacity,
            visibility: layerConfig.visibility,
            params: layerConfig.params
        });
        return LayerUtils.explodeLayers([{
            id: id,
            type: "placeholder",
            title: layerConfig.name,
            role: LayerRole.USERLAYER,
            loading: true,
            uuid: uuid.v4()
        }]);
    },
    insertPermalinkLayers(exploded, layers) {
        for (const layer of layers || []) {
            const insLayer = LayerUtils.explodeLayers([layer])[0];
            if (insLayer.layer.role !== LayerRole.USERLAYER || insLayer.layer.type !== 'vector') {
                continue;
            }
            delete insLayer.layer.pos;
            exploded.splice(layer.pos, 0, insLayer);
        }
    },
    collectWMSSublayerParams(sublayer, layerNames, opacities, styles, queryable, visibilities, parentVisibility) {
        const layerVisibility = (sublayer.visibility === undefined ? true : sublayer.visibility);
        const visibility = layerVisibility && parentVisibility;
        if (visibility || visibilities) {
            if (!isEmpty(sublayer.sublayers)) {
                // Is group
                sublayer.sublayers.map(sublyr => {
                    LayerUtils.collectWMSSublayerParams(sublyr, layerNames, opacities, styles, queryable, visibilities, visibility);
                });
            } else {
                layerNames.push(sublayer.name);
                opacities.push(Number.isInteger(sublayer.opacity) ? sublayer.opacity : 255);
                styles.push(sublayer.style || "");
                if (sublayer.queryable) {
                    queryable.push(sublayer.name);
                }
                if (visibilities) {
                    visibilities.push(layerVisibility ? (parentVisibility ? 1 : 0.5) : 0);
                }
            }
        }
    },
    buildWMSLayerParams(layer) {
        const params = layer.params || {};
        let newParams = {};
        let queryLayers = [];

        if (!Array.isArray(layer.sublayers)) {
            newParams = {
                LAYERS: params.LAYERS || layer.name,
                OPACITIES: params.OPACITIES || ("" + (layer.opacity !== undefined ? layer.opacity : 255)),
                STYLES: params.STYLES || "",
                ...layer.dimensionValues
            };
            queryLayers = layer.queryable ? [layer.name] : [];
        } else {
            let layerNames = [];
            let opacities = [];
            let styles = [];
            layer.sublayers.map(sublayer => {
                LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, styles, queryLayers, null, layer.visibility);
            });
            layerNames.reverse();
            opacities.reverse();
            styles.reverse();
            if (layer.drawingOrder && layer.drawingOrder.length > 0) {
                const indices = layer.drawingOrder.map(lyr => layerNames.indexOf(lyr)).filter(idx => idx >= 0);
                layerNames = indices.map(idx => layerNames[idx]);
                opacities = indices.map(idx => opacities[idx]);
                styles = indices.map(idx => styles[idx]);
            }
            newParams = {
                LAYERS: layerNames.join(","),
                OPACITIES: opacities.join(","),
                STYLES: styles.join(","),
                ...layer.dimensionValues
            };
        }
        return {
            params: newParams,
            queryLayers: queryLayers
        };
    },
    addUUIDs(group, usedUUIDs = new Set()) {
        group.uuid = !group.uuid || usedUUIDs.has(group.uuid) ? uuid.v4() : group.uuid;
        usedUUIDs.add(group.uuid);
        if (!isEmpty(group.sublayers)) {
            Object.assign(group, {sublayers: group.sublayers.slice(0)});
            for (let i = 0; i < group.sublayers.length; ++i) {
                group.sublayers[i] = {...group.sublayers[i]};
                LayerUtils.addUUIDs(group.sublayers[i], usedUUIDs);
            }
        }
    },
    buildWMSLayerUrlParam(layers) {
        const layernames = [];
        const opacities = [];
        const styles = [];
        const visibilities = [];
        const queryable = [];
        for (const layer of layers) {
            if (layer.role === LayerRole.THEME) {
                LayerUtils.collectWMSSublayerParams(layer, layernames, opacities, styles, queryable, visibilities, layer.visibility);
            } else if (layer.role === LayerRole.USERLAYER && layer.type === "wms") {
                const sublayernames = [];
                LayerUtils.collectWMSSublayerParams(layer, sublayernames, opacities, styles, queryable, visibilities, layer.visibility);
                let layerurl = layer.url;
                if (layer.extwmsparams) {
                    layerurl += (layerurl.includes('?') ? '&' : '?') + Object.entries(layer.extwmsparams || {}).map(([key, value]) => 'extwms.' + key + "=" + value).join('&');
                }
                layernames.push(...sublayernames.map(name => "wms:" + layerurl + "#" + name));
            } else if (layer.role === LayerRole.USERLAYER && (layer.type === "wfs" || layer.type === "wmts")) {
                layernames.push(layer.type + ':' + (layer.capabilitiesUrl || layer.url) + "#" + layer.name);
                opacities.push(layer.opacity);
                styles.push(layer.style);
                visibilities.push(layer.visibility);
            } else if (layer.role === LayerRole.USERLAYER && layer.type === "separator") {
                layernames.push("sep:" + layer.title);
                opacities.push(255);
                styles.push('');
                visibilities.push(true);
            }
        }
        const result = layernames.map((layername, idx) => {
            let param = layername;
            if (opacities[idx] < 255) {
                param += "[" + (100 - Math.round(opacities[idx] / 255 * 100)) + "]";
            }
            if (visibilities[idx] === 0) {
                param += '!';
            } else if (visibilities[idx] === 0.5) {
                param += '~';
            }
            return param;
        });
        if (ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
            result.reverse();
        }
        return result.join(",");

    },
    splitLayerUrlParam(entry) {
        const nameOpacityPattern = /([^[]+)\[(\d+)]/;
        const id = uuid.v4();
        let type = 'theme';
        let layerUrl = null;
        let opacity = 255;
        let visibility = true;
        let tristate = false;
        if (entry.endsWith('!')) {
            visibility = false;
            entry = entry.slice(0, -1);
        } else if (entry.endsWith('~')) {
            visibility = false;
            tristate = true;
            entry = entry.slice(0, -1);
        }
        let name = entry;
        let match = nameOpacityPattern.exec(entry);
        if (match) {
            name = match[1];
            opacity = Math.round(255 - parseFloat(match[2]) / 100 * 255);
        }
        if ((match = name.match(/^(\w+):(.*)#([^#]+)$/))) {
            type = match[1];
            layerUrl = match[2];
            name = match[3];
        } else if (name.startsWith('sep:')) {
            type = 'separator';
            name = name.slice(4);
        }
        return {id, type, url: layerUrl, name, opacity, visibility, tristate};
    },
    pathEqualOrBelow(parent, child) {
        return isEqual(child.slice(0, parent.length), parent);
    },
    removeLayer(layers, layer, sublayerpath) {
        // Extract foreground layers
        const fglayers = layers.filter(lyr => lyr.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Remove matching entries
        exploded = exploded.filter(entry => entry.layer.uuid !== layer.uuid || !LayerUtils.pathEqualOrBelow(sublayerpath, entry.path));
        // Re-assemble layers
        const newlayers = LayerUtils.implodeLayers(exploded);
        for (const lyr of newlayers) {
            if (lyr.type === "wms") {
                Object.assign(lyr, LayerUtils.buildWMSLayerParams(lyr));
            }
        }
        // Ensure theme layer is never removed
        if (!newlayers.find(lyr => lyr.role === LayerRole.THEME)) {
            const oldThemeLayer = layers.find(lyr => lyr.role === LayerRole.THEME);
            if (oldThemeLayer) {
                const newThemeLayer = {...oldThemeLayer, sublayers: []};
                Object.assign(newThemeLayer, LayerUtils.buildWMSLayerParams(newThemeLayer));
                newlayers.push(newThemeLayer);
            }
        }
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(lyr => lyr.role === LayerRole.BACKGROUND)
        ];
    },
    insertSeparator(layers, title, beforelayerId, beforesublayerpath) {
        // Extract foreground layers
        const fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        const exploded = LayerUtils.explodeLayers(fglayers);
        // Remove matching entries
        const pos = exploded.findIndex(entry => entry.layer.id === beforelayerId && isEqual(beforesublayerpath, entry.path));
        if (pos !== -1) {
            // Add separator
            exploded.splice(pos, 0, LayerUtils.createSeparatorLayer(title)[0]);
        }
        // Re-assemble layers
        const newlayers = LayerUtils.implodeLayers(exploded);
        for (const layer of newlayers) {
            if (layer.type === "wms") {
                Object.assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },
    reorderLayer(layers, movelayer, sublayerpath, delta, preventSplittingGroups) {
        // Extract foreground layers
        const fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        const exploded = LayerUtils.explodeLayers(fglayers);
        // Find entry to move
        if (movelayer) {
            const indices = exploded.reduce((result, entry, index) => {
                if (entry.layer.uuid === movelayer.uuid && LayerUtils.pathEqualOrBelow(sublayerpath, entry.path)) {
                    return [...result, index];
                }
                return result;
            }, []);
            if (isEmpty(indices)) {
                return layers;
            }
            indices.sort((a, b) => a - b);
            if ((delta < 0 && indices[0] <= 0) || (delta > 0 && indices[indices.length - 1] >= exploded.length - 1)) {
                return layers;
            }
            if (preventSplittingGroups) {
                // Prevent moving an entry out of a containing group
                const idx = delta < 0 ? indices[0] : indices[indices.length - 1];
                const level = sublayerpath.length;
                if (level > exploded[idx + delta].path.length || !isEqual(exploded[idx + delta].path.slice(0, level - 1), sublayerpath.slice(0, -1))) {
                    return layers;
                }
                // Avoid splitting sibling groups when reordering
                if (exploded[idx + delta].path.length > level || !isEqual(exploded[idx + delta].path.slice(0, -1), sublayerpath.slice(0, -1))) {
                    // Find next slot
                    const siblinggrouppath = exploded[idx + delta].path.slice(0, level);
                    siblinggrouppath[siblinggrouppath.length - 1] += delta;
                    while (idx + delta >= 0 && idx + delta < exploded.length && (exploded[idx + delta].path.length > level || !isEqual(exploded[idx + delta].path.slice(0, level), siblinggrouppath))) {
                        delta += delta > 0 ? 1 : -1;
                    }
                    // The above logic adds the number of items to skip to the delta which is already -1 or +1, so we need to decrease delta by one accordingly
                    if (Math.abs(delta) > 1) {
                        delta += delta > 0 ? -1 : 1;
                    }
                    if (idx + delta < 0 || idx + delta >= exploded.length) {
                        return layers;
                    }
                }
            }
            // Reorder layer
            if (delta < 0) {
                for (const idx of indices) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            } else {
                for (const idx of indices.reverse()) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            }
        }
        // Re-assemble layers
        const newlayers = LayerUtils.implodeLayers(exploded);
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },
    explodeLayers(layers) {
        // Return array with one entry for every single sublayer)
        const exploded = [];
        for (const layer of layers) {
            if (!isEmpty(layer.sublayers)) {
                this.explodeSublayers(layer, layer, exploded);
            } else {
                const newLayer = {...layer};
                if (newLayer.sublayers) {
                    newLayer.sublayers = [...newLayer.sublayers];
                }
                exploded.push({layer: newLayer, path: [], sublayer: newLayer});
            }
        }
        return exploded;
    },
    explodeSublayers(layer, parent, exploded, parentpath = []) {
        for (let idx = 0; idx < parent.sublayers.length; ++idx) {
            const path = [...parentpath, idx];
            if (parent.sublayers[idx].sublayers) {
                LayerUtils.explodeSublayers(layer, parent.sublayers[idx], exploded, path);
            } else {
                // Reduced layer with one single sublayer per level, up to leaf
                const redLayer = {...layer};
                let group = redLayer;
                for (const jdx of path) {
                    group.sublayers = [{...group.sublayers[jdx]}];
                    group = group.sublayers[0];
                }
                exploded.push({layer: redLayer, path: path, sublayer: group});
            }
        }
    },
    implodeLayers(exploded) {
        const newlayers = [];
        const usedLayerUUids = new Set();

        // Merge all possible items of an exploded layer array
        for (const entry of exploded) {
            const layer = entry.layer;

            // Attempt to merge with previous if possible
            let target = newlayers.length > 0 ? newlayers[newlayers.length - 1] : null;
            let source = layer;
            if (target && target.sublayers && target.id === layer.id) {
                let innertarget = target.sublayers[target.sublayers.length - 1];
                let innersource = source.sublayers[0]; // Exploded entries have only one entry per sublayer level
                while (innertarget && innertarget.sublayers && innertarget.name === innersource.name) {
                    target = innertarget;
                    source = innersource;
                    innertarget = target.sublayers[target.sublayers.length - 1];
                    innersource = source.sublayers[0]; // Exploded entries have only one entry per sublayer level
                }
                target.sublayers.push(source.sublayers[0]);
                LayerUtils.addUUIDs(source.sublayers[0], usedLayerUUids);
            } else {
                newlayers.push(layer);
                LayerUtils.addUUIDs(layer, usedLayerUUids);
            }
        }
        // Ensure mutually exclusive groups have exactly one visible layer
        for (const layer of newlayers) {
            LayerUtils.ensureMutuallyExclusive(layer);
        }
        for (const layer of newlayers) {
            if (layer.type === "wms") {
                Object.assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        return newlayers;
    },
    insertLayer(layers, newlayer, beforeattr, beforeval) {
        const exploded = LayerUtils.explodeLayers(layers);
        const explodedAdd = LayerUtils.explodeLayers([newlayer]);
        const index = exploded.findIndex(entry => entry.sublayer[beforeattr] === beforeval);
        if (index !== -1) {
            exploded.splice(index, 0, ...explodedAdd);
        }
        return LayerUtils.implodeLayers(exploded);
    },
    ensureMutuallyExclusive(group) {
        if (!isEmpty(group.sublayers)) {
            if (group.mutuallyExclusive) {
                const tristateSublayer = group.sublayers.find(sublayer => sublayer.tristate === true);
                const visibleSublayer = tristateSublayer || group.sublayers.find(sublayer => sublayer.visibility === true) || group.sublayers[0];
                for (const sublayer of group.sublayers) {
                    sublayer.visibility = sublayer === visibleSublayer;
                }
            }
            for (const sublayer of group.sublayers) {
                LayerUtils.ensureMutuallyExclusive(sublayer);
            }
        }
    },
    getSublayerNames(layer) {
        return [layer.name].concat((layer.sublayers || []).reduce((list, sublayer) => {
            return list.concat([...this.getSublayerNames(sublayer)]);
        }, [])).filter(x => x);
    },
    mergeSubLayers(baselayer, addlayer) {
        addlayer = {...baselayer, sublayers: addlayer.sublayers};
        addlayer.externalLayerMap = addlayer.externalLayerMap || {};
        LayerUtils.extractExternalLayersFromSublayers(addlayer, addlayer);
        LayerUtils.addUUIDs(addlayer);
        if (isEmpty(addlayer.sublayers)) {
            return {...baselayer};
        }
        if (isEmpty(baselayer.sublayers)) {
            return addlayer;
        }
        const explodedBase = LayerUtils.explodeLayers([baselayer]);
        const existing = explodedBase.map(entry => entry.sublayer.name);
        let explodedAdd = LayerUtils.explodeLayers([addlayer]);
        explodedAdd = explodedAdd.filter(entry => !existing.includes(entry.sublayer.name));
        return LayerUtils.implodeLayers(explodedAdd.concat(explodedBase))[0];
    },
    searchSubLayer(layer, attr, value, path = []) {
        if (layer.sublayers) {
            let idx = 0;
            for (const sublayer of layer.sublayers) {
                const match = sublayer[attr] === value ? sublayer : LayerUtils.searchSubLayer(sublayer, attr, value, path);
                if (match) {
                    path.unshift(idx);
                    return match;
                }
                idx += 1;
            }
        } else {
            if (layer[attr] === value) {
                return layer;
            }
        }
        return null;
    },
    searchLayer(layers, key, value, roles = [LayerRole.THEME, LayerRole.USERLAYER]) {
        for (const layer of layers) {
            if (roles.includes(layer.role)) {
                const matchsublayer = LayerUtils.searchSubLayer(layer, key, value);
                if (matchsublayer) {
                    return {layer: layer, sublayer: matchsublayer};
                }
            }
        }
        return null;
    },
    sublayerVisible(layer, sublayerpath) {
        let visible = layer.visibility !== false;
        let sublayer = layer;
        for (const index of sublayerpath) {
            sublayer = sublayer.sublayers[index];
            visible &= sublayer.visibility !== false;
            if (!visible) {
                return false;
            }
        }
        return true;
    },
    computeLayerVisibility(layer) {
        if (isEmpty(layer.sublayers) || layer.visibility === false) {
            return layer.visibility ? 1 : 0;
        }
        let visible = 0;
        layer.sublayers.map(sublayer => {
            const sublayervisibility = sublayer.visibility === undefined ? true : sublayer.visibility;
            if (sublayer.sublayers && sublayervisibility) {
                visible += LayerUtils.computeLayerVisibility(sublayer);
            } else {
                visible += sublayervisibility ? 1 : 0;
            }
        });
        return visible / layer.sublayers.length;
    },
    cloneLayer(layer, sublayerpath) {
        const newlayer = {...layer};
        let cur = newlayer;
        for (let i = 0; i < sublayerpath.length; ++i) {
            const idx = sublayerpath[i];
            cur.sublayers = [
                ...cur.sublayers.slice(0, idx),
                {...cur.sublayers[idx]},
                ...cur.sublayers.slice(idx + 1)
            ];
            cur = cur.sublayers[idx];
        }
        return {newlayer, newsublayer: cur};
    },
    collectGroupLayers(layer, parentGroups, groupLayers) {
        if (!isEmpty(layer.sublayers)) {
            for (const sublayer of layer.sublayers) {
                LayerUtils.collectGroupLayers(sublayer, parentGroups.concat(layer.name), groupLayers);
            }
        } else {
            for (const group of parentGroups) {
                groupLayers[group] = (groupLayers[group] || []).concat(layer.name);
            }
        }
    },
    replaceLayerGroups(layerConfigs, layer) {
        const groupLayers = {};
        LayerUtils.collectGroupLayers(layer, [], groupLayers);
        const newLayerConfigs = [];
        for (const layerConfig of layerConfigs) {
            if (layerConfig.name in groupLayers) {
                newLayerConfigs.push(...groupLayers[layerConfig.name].map(name => ({...layerConfig, name})));
            } else {
                newLayerConfigs.push(layerConfig);
            }
        }
        return newLayerConfigs;
    },
    extractExternalLayersFromSublayers(toplayer, layer) {
        if (layer.sublayers) {
            layer.sublayers = layer.sublayers.map(sublayer => {
                if (sublayer.externalLayer) {
                    const externalLayer = {...sublayer.externalLayer};
                    LayerUtils.completeExternalLayer(externalLayer);
                    toplayer.externalLayerMap[sublayer.name] = externalLayer;
                    sublayer = {...sublayer};
                    delete sublayer.externalLayer;
                }
                if (sublayer.sublayers) {
                    LayerUtils.extractExternalLayersFromSublayers(toplayer, sublayer);
                }
                return sublayer;
            });
        }
    },
    completeExternalLayer(externalLayer) {
        externalLayer.title = externalLayer.title || externalLayer.name;
        externalLayer.uuid = uuid.v4();
        if (externalLayer.type === "wms" || externalLayer.params) {
            externalLayer.version = externalLayer.version || "1.3.0";
            externalLayer.featureInfoUrl = externalLayer.featureInfoUrl || externalLayer.url;
            externalLayer.legendUrl = externalLayer.legendUrl || externalLayer.url;
            externalLayer.queryLayers = externalLayer.queryLayers || externalLayer.params.LAYERS.split(",");

            const externalLayerFeatureInfoFormats = ConfigUtils.getConfigProp("externalLayerFeatureInfoFormats") || {};
            for (const entry of Object.keys(externalLayerFeatureInfoFormats)) {
                if (externalLayer.featureInfoUrl.toLowerCase().includes(entry.toLowerCase())) {
                    externalLayer.infoFormats = [externalLayerFeatureInfoFormats[entry]];
                    break;
                }
            }
        }
    },
    getLegendUrl(layer, sublayer, scale, map, bboxDependentLegend, scaleDependentLegend, extraLegendParams) {
        if (layer.type !== "wms") {
            return layer.legendUrl || "";
        }
        const requestParams = {
            SERVICE: "WMS",
            REQUEST: "GetLegendGraphic",
            FORMAT: "image/png",
            CRS: map.projection,
            SLD_VERSION: "1.1.0"
        };
        if (extraLegendParams) {
            Object.assign(requestParams, Object.fromEntries(extraLegendParams.split("&").map(entry => entry.split("="))));
        }
        if (scaleDependentLegend === true || (scaleDependentLegend === "theme" && layer.role === LayerRole.THEME)) {
            requestParams.SCALE = Math.round(scale);
        }
        if (bboxDependentLegend === true || (bboxDependentLegend === "theme" && layer.role === LayerRole.THEME)) {
            requestParams.WIDTH = map.size.width;
            requestParams.HEIGHT = map.size.height;
            const bounds = map.bbox.bounds;
            if (CoordinatesUtils.getAxisOrder(map.projection).substr(0, 2) === 'ne' && layer.version === '1.3.0') {
                requestParams.BBOX = [bounds[1], bounds[0], bounds[3], bounds[2]].join(",");
            } else {
                requestParams.BBOX = bounds.join(",");
            }
        }
        if (layer.externalLayerMap && layer.externalLayerMap[sublayer.name]) {
            const externalLayer = layer.externalLayerMap[sublayer.name];
            if (externalLayer.type !== "wms") {
                return externalLayer.legendUrl || "";
            }
            const urlParts = url.parse(externalLayer.legendUrl, true);
            urlParts.query = {
                VERSION: layer.version,
                ...urlParts.query,
                ...requestParams,
                LAYER: externalLayer.params.LAYERS
            };
            delete urlParts.search;
            return url.format(urlParts);
        } else {
            const urlParts = url.parse(layer.legendUrl, true);
            urlParts.query = {
                VERSION: layer.version,
                ...urlParts.query,
                ...requestParams,
                LAYER: sublayer.name
            };
            delete urlParts.search;
            return url.format(urlParts);
        }
    },
    layerScaleInRange(layer, mapScale) {
        return (layer.minScale === undefined || mapScale >= layer.minScale) && (layer.maxScale === undefined || mapScale < layer.maxScale);
    },
    addExternalLayerPrintParams(layer, params, printCrs, counterRef) {
        const qgisServerVersion = (ConfigUtils.getConfigProp("qgisServerVersion") || 3);
        if (qgisServerVersion >= 3) {
            if (layer.type === "wms") {
                const names = layer.params.LAYERS.split(",");
                const opacities = layer.params.OPACITIES.split(",");
                for (let idx = 0; idx < names.length; ++idx) {
                    const identifier = String.fromCharCode(65 + (counterRef[0]++));
                    params.LAYERS.push("EXTERNAL_WMS:" + identifier);
                    params.OPACITIES.push(opacities[idx]);
                    params.COLORS.push("");
                    params[identifier + ":url"] = layer.url;
                    params[identifier + ":layers"] = names[idx];
                    params[identifier + ":format"] = "image/png";
                    params[identifier + ":crs"] = printCrs;
                    params[identifier + ":styles"] = "";
                    params[identifier + ":dpiMode"] = "7";
                    params[identifier + ":contextualWMSLegend"] = "0";
                    if (layer.url.includes("?")) {
                        params[identifier + ":IgnoreGetMapUrl"] = "1";
                    }
                    Object.entries(layer.extwmsparams || {}).forEach(([key, value]) => {
                        params[identifier + ":" + key] = value;
                    });
                }
            }
        } else if (qgisServerVersion === 2) {
            if (layer.type === "wms") {
                // Handled by qwc-print-service
                params.LAYERS.push(`wms:${layer.url}#${layer.params.LAYERS}`);
            } else if (layer.type === "wfs") {
                // Handled by qwc-print-service
                params.LAYERS.push(`wfs:${layer.url}#${layer.name}`);
            }
        }
    },
    collectPrintParams(layers, theme, printScale, printCrs, printExternalLayers) {
        const params = {
            LAYERS: [],
            OPACITIES: [],
            COLORS: []
        };
        let counterRef = [0];

        for (const layer of layers) {
            if (layer.role === LayerRole.THEME && layer.params.LAYERS) {
                params.LAYERS.push(layer.params.LAYERS);
                params.OPACITIES.push(layer.params.OPACITIES);
                params.COLORS.push(layer.params.LAYERS.split(",").map(() => "").join(","));
            } else if (printExternalLayers && layer.role === LayerRole.USERLAYER) {
                LayerUtils.addExternalLayerPrintParams(layer, params, printCrs, counterRef);
            }
        }

        const backgroundLayer = layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
        if (backgroundLayer) {
            const backgroundLayerName = backgroundLayer.name;
            const themeBackgroundLayer = theme.backgroundLayers.find(entry => entry.name === backgroundLayerName);
            const printBackgroundLayer = themeBackgroundLayer ? themeBackgroundLayer.printLayer : null;
            if (printBackgroundLayer) {
                // Use printLayer defined in qgis project
                let printBgLayerName = printBackgroundLayer;
                if (Array.isArray(printBackgroundLayer)) {
                    printBgLayerName = null;
                    for (let i = 0; i < printBackgroundLayer.length; ++i) {
                        printBgLayerName = printBackgroundLayer[i].name;
                        if (printScale <= printBackgroundLayer[i].maxScale) {
                            break;
                        }
                    }
                }
                if (printBgLayerName) {
                    params.LAYERS.push(printBgLayerName);
                    params.OPACITIES.push("255");
                    params.COLORS.push("");
                }
            } else if (printExternalLayers) {
                // Inject client-side wms as external layer for print
                const items = backgroundLayer.type === "group" ? backgroundLayer.items : [backgroundLayer];
                items.slice(0).reverse().forEach(layer => {
                    if (LayerUtils.layerScaleInRange(layer, printScale)) {
                        LayerUtils.addExternalLayerPrintParams(layer, params, printCrs, counterRef);
                    }
                });
            }
        }
        params.LAYERS = params.LAYERS.reverse().join(",");
        params.OPACITIES = params.OPACITIES.reverse().join(",");
        params.COLORS = params.COLORS.reverse().join(",");
        return params;
    },
    getTimeDimensionValues(layer) {
        const result = {
            names: new Set(),
            values: new Set(),
            attributes: {}
        };
        if (layer.visibility) {
            (layer.dimensions || []).forEach(dimension => {
                if (dimension.units === "ISO8601" && dimension.value) {
                    result.names.add(dimension.name);
                    dimension.value.split(/,\s+/).filter(x => x).forEach(x => result.values.add(x));
                    result.attributes[layer.name] = [dimension.fieldName, dimension.endFieldName];
                }
            });
        }
        (layer.sublayers || []).forEach(sublayer => {
            const sublayerResult = LayerUtils.getTimeDimensionValues(sublayer);
            sublayerResult.names.forEach(x => result.names.add(x));
            sublayerResult.values.forEach(x => result.values.add(x));
            result.attributes = {...result.attributes, ...sublayerResult.attributes};
        });
        return result;
    },
    getAttribution(layer, map, showThemeAttributionOnly = false, transformedMapBBoxes = {}) {
        if (layer.visibility === false || (showThemeAttributionOnly && layer.role !== LayerRole.THEME)) {
            return {};
        }

        const mapScale = MapUtils.computeForZoom(map.scales, map.zoom);
        if (!LayerUtils.layerScaleInRange(layer, mapScale)) {
            return {};
        }

        if (layer.bbox) {
            const layerCrs = layer.bbox.crs || map.projection;
            if (!transformedMapBBoxes[layerCrs]) {
                transformedMapBBoxes[layerCrs] = CoordinatesUtils.reprojectBbox(map.bbox.bounds, map.projection, layerCrs);
            }
            const mapbbox = transformedMapBBoxes[layerCrs];
            const laybbox = layer.bbox.bounds;
            if (
                mapbbox[0] > laybbox[2] || mapbbox[2] < laybbox[0] ||
                mapbbox[1] > laybbox[3] || mapbbox[3] < laybbox[1]
            ) {
                // Extents don't overlap
                return {};
            }
        }

        const copyrights = {};

        if (layer.sublayers) {
            Object.assign(
                copyrights,
                layer.sublayers.reduce((res, sublayer) => ({...res, ...LayerUtils.getAttribution(sublayer, map, false, transformedMapBBoxes)}), {})
            );
        } else if (layer.type === "group" && layer.items) {
            Object.assign(
                copyrights,
                layer.items.reduce((res, sublayer) => ({...res, ...LayerUtils.getAttribution(sublayer, map, false, transformedMapBBoxes)}), {})
            );
        }
        if (layer.attribution && layer.attribution.Title) {
            const key = layer.attribution.OnlineResource || layer.attribution.Title;
            copyrights[key] = {
                title: layer.attribution.OnlineResource ? layer.attribution.Title : null,
                layers: [ ...((copyrights[key] || {}).layers || []), layer]
            };
        }
        return copyrights;
    }
};

export default LayerUtils;

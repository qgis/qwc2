/**
* Copyright 2016, Sourcepole AG.
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
import {LayerRole} from '../actions/layers';

const LayerUtils = {
    restoreLayerParams(themeLayer, layerConfigs, permalinkLayers, externalLayers) {
        let exploded = LayerUtils.explodeLayers([themeLayer]);
        // Restore theme layer configuration
        for (const entry of exploded) {
            const layerConfig = layerConfigs.find(layer => layer.type === 'theme' && layer.name === entry.sublayer.name);
            if (layerConfig) {
                entry.sublayer.opacity = layerConfig.opacity;
                entry.sublayer.visibility = layerConfig.visibility;
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
        return LayerUtils.implodeLayers(exploded);
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
                    entry.sublayer.visibility = layerConfig.visibility;
                    reordered.push(entry);
                }
            } else if (layerConfig.type === 'separator') {
                reordered = reordered.concat(LayerUtils.createSeparatorLayer(layerConfig.name));
            } else {
                reordered = reordered.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers, layerConfig.id));
            }
        }
        LayerUtils.insertPermalinkLayers(reordered, permalinkLayers);
        return LayerUtils.implodeLayers(reordered);
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
            visibility: layerConfig.visibility
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
            delete insLayer.layer.pos;
            exploded.splice(layer.pos, 0, insLayer);
        }
    },
    collectWMSSublayerParams(sublayer, layerNames, opacities, queryable, visibilities) {
        const visibility = sublayer.visibility === undefined ? true : sublayer.visibility;
        if (visibility || visibilities) {
            if (!isEmpty(sublayer.sublayers)) {
                // Is group
                sublayer.sublayers.map(sublyr => {
                    LayerUtils.collectWMSSublayerParams(sublyr, layerNames, opacities, queryable, visibilities);
                });
            } else {
                layerNames.push(sublayer.name);
                opacities.push(Number.isInteger(sublayer.opacity) ? sublayer.opacity : 255);
                if (sublayer.queryable) {
                    queryable.push(sublayer.name);
                }
                if (visibilities) {
                    visibilities.push(visibility);
                }
            }
        }
    },
    buildWMSLayerParams(layer) {
        // Handle QGIS Server setups without rewrite rule
        const query = url.parse(layer.url, true).query;

        if (!Array.isArray(layer.sublayers)) {
            return {
                params: {...(layer.params || {LAYERS: layer.name}), MAP: query.map || query.MAP || (layer.params || {}).map || (layer.params || {}).MAP},
                queryLayers: layer.queryable ? [layer.name] : []
            };
        }
        let layerNames = [];
        let opacities = [];
        const queryLayers = [];
        layer.sublayers.map(sublayer => {
            LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, queryLayers);
        });
        layerNames.reverse();
        opacities.reverse();
        if (layer.drawingOrder && layer.drawingOrder.length > 0) {
            const indices = layer.drawingOrder.map(lyr => layerNames.indexOf(lyr)).filter(idx => idx >= 0);
            layerNames = indices.map(idx => layerNames[idx]);
            opacities = indices.map(idx => opacities[idx]);
        }
        const newParams = {
            ...layer.params,
            LAYERS: layerNames.join(","),
            OPACITIES: opacities.join(","),
            MAP: query.map || query.MAP || (layer.params || {}).map || (layer.params || {}).MAP
        };
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
        const visibilities = [];
        const queryable = [];
        for (const layer of layers) {
            if (layer.role === LayerRole.THEME) {
                LayerUtils.collectWMSSublayerParams(layer, layernames, opacities, queryable, visibilities);
            } else if (layer.role === LayerRole.USERLAYER && (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts")) {
                layernames.push(layer.type + ':' + (layer.capabilitiesUrl || layer.url) + "#" + layer.name);
                opacities.push(layer.opacity);
                visibilities.push(layer.visibility);
            } else if (layer.role === LayerRole.USERLAYER && layer.type === "separator") {
                layernames.push("sep:" + layer.title);
                opacities.push(255);
                visibilities.push(true);
            }
        }
        const result = layernames.map((layername, idx) => {
            let param = layername;
            if (opacities[idx] < 255) {
                param += "[" + (100 - Math.round(opacities[idx] / 255 * 100)) + "]";
            }
            if (!visibilities[idx]) {
                param += '!';
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
        if (entry.endsWith('!')) {
            visibility = false;
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
        return {id, type, layerUrl, name, opacity, visibility};
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
                if (!isEqual(exploded[idx + delta].path.slice(0, sublayerpath.length - 1), sublayerpath.slice(0, -1))) {
                    return layers;
                }
                // Avoid splitting sibling groups when reordering
                if (!isEqual(exploded[idx + delta].path.slice(0, -1), sublayerpath.slice(0, -1))) {
                    // Find next slot
                    const level = sublayerpath.length;
                    const siblinggrouppath = exploded[idx + delta].path.slice(0, level);
                    siblinggrouppath[siblinggrouppath.length - 1] += delta;
                    while (idx + delta >= 0 && idx + delta < exploded.length && !isEqual(exploded[idx + delta].path.slice(0, level), siblinggrouppath)) {
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
                const visibleSublayer = group.sublayers.find(sublayer => sublayer.visibility === true) || group.sublayers[0];
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
        }, []));
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
                    const externalLayer = {
                        ...sublayer.externalLayer,
                        title: sublayer.externalLayer.title || sublayer.externalLayer.name,
                        uuid: uuid.v4()
                    };
                    if (externalLayer.type === "wms") {
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
    getLegendUrl(layer, sublayer, scale, projection, map) {
        const name = (layer.externalLayerMap || {})[sublayer.name] ? layer.externalLayerMap[sublayer.name].params.LAYERS : sublayer.name;
        let params = "SERVICE=WMS"
                   + "&REQUEST=GetLegendGraphic"
                   + "&VERSION=" + (layer.version || "1.3.0")
                   + "&FORMAT=image/png"
                   + "&LAYER=" + encodeURIComponent(name)
                   + "&CRS=" + projection
                   + "&SCALE=" + Math.round(scale)
                   + "&SLD_VERSION=1.1.0";
        if (map) {
            params += "&WIDTH=" + map.size.width
                    + "&HEIGHT=" + map.size.height
                    + "&BBOX=" + map.bbox.bounds.join(",");
        }
        let requestUrl = layer.legendUrl;
        if (layer.externalLayerMap && layer.externalLayerMap[sublayer.name]) {
            requestUrl = layer.externalLayerMap[sublayer.name].legendUrl;
        }
        return requestUrl + (requestUrl.indexOf('?') === -1 ? '?' : '&') + params;
    }
};

export default LayerUtils;

/**
* Copyright 2016, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const assign = require('object-assign');
const isEmpty = require('lodash.isempty');
const isEqual = require('lodash.isequal');
const uuid = require('uuid');
const url = require('url');
const ConfigUtils = require('./ConfigUtils');
const {LayerRole} = require('../actions/layers');

const LayerUtils = {
    restoreLayerParams: function(themeLayer, layerConfigs, permalinkLayers, externalLayers) {
        let exploded = LayerUtils.explodeLayers([themeLayer]);
        // Restore theme layer configuration
        for(let entry of exploded) {
            let layerConfig = layerConfigs.find(layer => layer.type === 'theme' && layer.name === entry.sublayer.name);
            if(layerConfig) {
                entry.sublayer.opacity = layerConfig.opacity;
                entry.sublayer.visibility = layerConfig.visibility;
            } else {
                entry.sublayer.visibility = false;
            }
        }
        // Create placeholders for external layers to be added in front
        let external = [];
        for(let layerConfig of layerConfigs) {
            if(layerConfig.type === 'separator') {
                // No point restoring separators
            } else if(layerConfig.type !== 'theme') {
                external = external.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers, layerConfig.id));
            }
        }
        exploded = [...external, ...exploded];
        LayerUtils.insertPermalinkLayers(exploded, permalinkLayers);
        return LayerUtils.implodeLayers(exploded);
    },
    restoreOrderedLayerParams: function(themeLayer, layerConfigs, permalinkLayers, externalLayers) {
        let exploded = LayerUtils.explodeLayers([themeLayer]);
        let reordered = [];
        // Iterate over layer configs and reorder items accordingly, create external layer placeholders as neccessary
        for(let layerConfig of layerConfigs) {
            if(layerConfig.type === 'theme') {
                let entry = exploded.find(entry => entry.sublayer.name === layerConfig.name);
                if(entry) {
                    entry.sublayer.opacity = layerConfig.opacity;
                    entry.sublayer.visibility = layerConfig.visibility;
                    reordered.push(entry);
                }
            } else if(layerConfig.type === 'separator') {
                reordered = reordered.concat(LayerUtils.createSeparatorLayer(layerConfig.name));
            } else {
                reordered = reordered.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers, layerConfig.id));
            }
        }
        LayerUtils.insertPermalinkLayers(reordered, permalinkLayers);
        return LayerUtils.implodeLayers(reordered);
    },
    createSeparatorLayer: function(title) {
        return LayerUtils.explodeLayers([{
            type: "separator",
            title: title,
            role: LayerRole.USERLAYER,
            uuid: uuid.v4(),
            id: uuid.v4()
        }]);
    },
    createExternalLayerPlaceholder: function(layerConfig, externalLayers, id) {
        let key = layerConfig.type + ":" + layerConfig.url;
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
    insertPermalinkLayers: function(exploded, layers) {
        for(let layer of layers || []) {
            let insLayer = LayerUtils.explodeLayers([layer])[0];
            delete insLayer.layer.pos;
            exploded.splice(layer.pos, 0, insLayer);
        }
    },
    collectWMSSublayerParams: function(sublayer, layerNames, opacities, queryable, visibilities) {
        let visibility = sublayer.visibility === undefined ? true : sublayer.visibility;
        if(visibility || visibilities) {
            if(!isEmpty(sublayer.sublayers)) {
                // Is group
                sublayer.sublayers.map(sublayer => {
                    LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, queryable, visibilities)
                });
            } else {
                layerNames.push(sublayer.name);
                opacities.push(Number.isInteger(sublayer.opacity) ? sublayer.opacity : 255);
                if(sublayer.queryable) {
                    queryable.push(sublayer.name)
                }
                if(visibilities) {
                    visibilities.push(visibility);
                }
            }
        }
    },
    buildWMSLayerParams: function(layer) {
        // Handle QGIS Server setups without rewrite rule
        let query = url.parse(layer.url, true).query;

        if(!Array.isArray(layer.sublayers)) {
            return {
                params: assign({}, layer.params || {LAYERS: layer.name}, {MAP: query.map || query.MAP || (layer.params || {}).map || (layer.params || {}).MAP}),
                queryLayers: layer.queryable ? [layer.name] : []
            };
        }
        let layerNames = [];
        let opacities = [];
        let queryLayers = [];
        layer.sublayers.map(sublayer => {
            LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, queryLayers);
        });
        layerNames.reverse();
        opacities.reverse();
        if(layer.drawingOrder && layer.drawingOrder.length > 0) {
            let indices = layer.drawingOrder.map(layer => layerNames.indexOf(layer)).filter(idx => idx >= 0);
            layerNames = indices.map(idx => layerNames[idx]);
            opacities = indices.map(idx => opacities[idx]);
        }
        let newParams = assign({}, layer.params, {
            LAYERS: layerNames.join(","),
            OPACITIES: opacities.join(","),
            MAP: query.map || query.MAP || (layer.params || {}).map || (layer.params || {}).MAP
        });
        return {
            params: newParams,
            queryLayers: queryLayers
        };
    },
    addUUIDs(group, usedUUIDs=new Set()) {
        group.uuid = !group.uuid || usedUUIDs.has(group.uuid) ? uuid.v4() : group.uuid;
        usedUUIDs.add(group.uuid);
        if(!isEmpty(group.sublayers)) {
            assign(group, {sublayers: group.sublayers.slice(0)});
            for(let i = 0; i < group.sublayers.length; ++i) {
                group.sublayers[i] = {...group.sublayers[i]};
                LayerUtils.addUUIDs(group.sublayers[i], usedUUIDs);
            }
        }
    },
    buildWMSLayerUrlParam(layers) {
        let layernames = [];
        let opacities = [];
        let visibilities = [];
        let queryable = [];
        for(let layer of layers) {
            if(layer.role === LayerRole.THEME) {
                LayerUtils.collectWMSSublayerParams(layer, layernames, opacities, queryable, visibilities);
            } else if(layer.role === LayerRole.USERLAYER && (layer.type === "wms" || layer.type === "wfs" || layer.type === "wmts")) {
                layernames.push(layer.type + ':' + (layer.capabilitiesUrl || layer.url) + "#" + layer.name);
                opacities.push(layer.opacity);
                visibilities.push(layer.visibility);
            } else if(layer.role === LayerRole.USERLAYER && layer.type === "separator") {
                layernames.push("sep:" + layer.title);
                opacities.push(255);
                visibilities.push(true);
            }
        }
        let result = layernames.map((layername, idx) => {
            let param = layername;
            if(opacities[idx] < 255){
                param += "[" + (100 - Math.round(opacities[idx] / 255. * 100)) + "]";
            }
            if(!visibilities[idx]) {
                param += '!';
            }
            return param;
        })
        if(ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
            result.reverse();
        }
        return result.join(",");

    },
    splitLayerUrlParam(entry) {
        const nameOpacityPattern = /([^\[]+)\[(\d+)]/;
        let id = uuid.v4();
        let type = 'theme';
        let url = null;
        let opacity = 255;
        let visibility = true;
        if(entry.endsWith('!')) {
            visibility = false;
            entry = entry.slice(0, -1);
        }
        let name = entry;
        let match = nameOpacityPattern.exec(entry);
        if(match) {
            name = match[1];
            opacity = Math.round(255 - parseFloat(match[2]) / 100 * 255);
        }
        if(match = name.match(/^(\w+):(.*)#([^#]+)$/)) {
            let cpos = name.indexOf(":");
            let hpos = name.lastIndexOf('#');
            type = match[1];
            url = match[2];
            name = match[3];
        } else if(name.startsWith('sep:')) {
            type = 'separator';
            name = name.slice(4);
        }
        return {id, type, url, name, opacity, visibility};
    },
    pathEqualOrBelow(parent, child) {
        return isEqual(child.slice(0, parent.length), parent);
    },
    removeLayer(layers, layer, sublayerpath, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Remove matching entries
        exploded = exploded.filter(entry => entry.layer.uuid !== layer.uuid || !LayerUtils.pathEqualOrBelow(sublayerpath, entry.path));
        // Re-assemble layers (if swipe is active, keep first sublayer separate)
        let newlayers = LayerUtils.implodeLayers(exploded, swipeActive);
        for(let layer of newlayers) {
            if(layer.type === "wms") {
                assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        // Ensure theme layer is never removed
        if(!newlayers.find(layer => layer.role === LayerRole.THEME)) {
            let oldThemeLayer = layers.find(layer => layer.role === LayerRole.THEME);
            if(oldThemeLayer) {
                let newThemeLayer = assign({}, oldThemeLayer, {sublayers: []});
                assign(newThemeLayer, LayerUtils.buildWMSLayerParams(newThemeLayer));
                newlayers.push(newThemeLayer);
            }
        }
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },
    insertSeparator(layers, title, beforelayerId, beforesublayerpath, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Remove matching entries
        let pos = exploded.findIndex(entry => entry.layer.id === beforelayerId && isEqual(beforesublayerpath, entry.path));
        if(pos !== -1) {
            // Add separator
            exploded.splice(pos, 0, LayerUtils.createSeparatorLayer(title)[0]);
        }
        // Re-assemble layers (if swipe is active, keep first sublayer separate)
        let newlayers = LayerUtils.implodeLayers(exploded, swipeActive);
        for(let layer of newlayers) {
            if(layer.type === "wms") {
                assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },
    reorderLayer(layers, movelayer, sublayerpath, delta, swipeActive, preventSplittingGroups) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Find entry to move
        if(movelayer) {
            let indices = exploded.reduce((result, entry, index) => {
                if(entry.layer.uuid === movelayer.uuid && LayerUtils.pathEqualOrBelow(sublayerpath, entry.path)) {
                    return [...result, index];
                }
                return result;
            }, []);
            if(isEmpty(indices)) {
                return layers;
            }
            indices.sort((a, b) => a - b);
            if((delta < 0 && indices[0] <= 0) || (delta > 0 && indices[indices.length - 1] >= exploded.length - 1)) {
                return layers;
            }
            if(preventSplittingGroups) {
                // Prevent moving an entry out of a containing group
                let idx = delta < 0 ? indices[0] : indices[indices.length - 1];
                if(!isEqual(exploded[idx + delta].path.slice(0, sublayerpath.length - 1), sublayerpath.slice(0, -1))) {
                    return layers;
                }
                // Avoid splitting sibling groups when reordering
                if(!isEqual(exploded[idx + delta].path.slice(0, -1), sublayerpath.slice(0, -1))) {
                    // Find next slot
                    let level = sublayerpath.length;
                    let siblinggrouppath = exploded[idx + delta].path.slice(0, level);
                    siblinggrouppath[siblinggrouppath.length - 1] += delta;
                    while(idx + delta >= 0 && idx + delta < exploded.length && !isEqual(exploded[idx + delta].path.slice(0, level), siblinggrouppath)) {
                        delta += delta > 0 ? 1 : -1;
                    }
                    // The above logic adds the number of items to skip to the delta which is already -1 or +1, so we need to decrease delta by one accordingly
                    delta += Math.abs(delta) > 1 ? (delta > 0 ? -1 : 1) : 0;
                    if(idx + delta < 0 || idx + delta >= exploded.length) {
                        return layers;
                    }
                }
            }
            // Reorder layer
            if(delta < 0) {
                for(let idx of indices) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            } else {
                for(let idx of indices.reverse()) {
                    exploded.splice(idx + delta, 0, exploded.splice(idx, 1)[0]);
                }
            }
        }
        // Re-assemble layers (if swipe is active, keep first sublayer separate)
        let newlayers = LayerUtils.implodeLayers(exploded, swipeActive);
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.role === LayerRole.BACKGROUND)
        ];
    },
    explodeLayers(layers) {
        // Return array with one entry for every single sublayer)
        let exploded = [];
        for(let layer of layers) {
            if(!isEmpty(layer.sublayers)) {
                this.explodeSublayers(layer, layer, exploded);
            } else {
                let newLayer = {...layer};
                if(newLayer.sublayers) {
                    newLayer.sublayers = [...newLayer.sublayers];
                }
                exploded.push({layer: newLayer, path: [], sublayer: newLayer});
            }
        }
        return exploded;
    },
    explodeSublayers(layer, parent, exploded, parentpath=[]) {
        for(let idx = 0; idx < parent.sublayers.length; ++idx) {
            let path = [...parentpath, idx];
            if(parent.sublayers[idx].sublayers) {
                LayerUtils.explodeSublayers(layer, parent.sublayers[idx], exploded, path);
            } else {
                // Reduced layer with one single sublayer per level, up to leaf
                let redLayer = {...layer};
                let group = redLayer;
                for(let idx of path) {
                    group.sublayers = [{...group.sublayers[idx]}];
                    group = group.sublayers[0];
                }
                exploded.push({layer: redLayer, path: path, sublayer: group});
            }
        }
    },
    implodeLayers(exploded, swipeActive=false) {
        let newlayers = [];
        let usedLayerUUids = new Set();

        // If swipe is active, keep first layer separate
        let swipeLayer = null;
        if(swipeActive && exploded.length > 0) {
            swipeLayer = exploded.shift().layer;
            LayerUtils.addUUIDs(swipeLayer, usedLayerUUids);
        }
        // Merge all possible items of an exploded layer array
        for(let entry of exploded) {
            let layer = entry.layer;

            // Attempt to merge with previous if possible
            let target = newlayers.length > 0 ? newlayers[newlayers.length - 1] : null;
            let source = layer;
            if(target && target.sublayers && target.id === layer.id) {
                let innertarget = target.sublayers[target.sublayers.length - 1];
                let innersource = source.sublayers[0]; // Exploded entries have only one entry per sublayer level
                while(innertarget && innertarget.sublayers && innertarget.name === innersource.name) {
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
        for(let layer of newlayers) {
            LayerUtils.ensureMutuallyExclusive(layer);
        }
        for(let layer of newlayers) {
            if(layer.type === "wms") {
                assign(layer, LayerUtils.buildWMSLayerParams(layer));
            }
        }
        if(swipeLayer) {
            newlayers.unshift(swipeLayer);
        }
        return newlayers;
    },
    insertLayer(layers, newlayer, beforeattr, beforeval) {
        let exploded = LayerUtils.explodeLayers(layers);
        let explodedAdd = LayerUtils.explodeLayers([newlayer]);
        let index = exploded.findIndex(entry => entry.sublayer[beforeattr] === beforeval);
        if(index !== -1) {
            exploded.splice(index, 0, ...explodedAdd);
        }
        return LayerUtils.implodeLayers(exploded);
    },
    ensureMutuallyExclusive(group) {
        if(!isEmpty(group.sublayers)) {
            if(group.mutuallyExclusive) {
                let visibleSublayer = group.sublayers.find(sublayer => sublayer.visibility === true) || group.sublayers[0];
                for(let sublayer of group.sublayers) {
                    sublayer.visibility = sublayer === visibleSublayer;
                }
            }
            for(let sublayer of group.sublayers) {
                LayerUtils.ensureMutuallyExclusive(sublayer);
            }
        }
    },
    getSublayerNames(layer) {
        return [layer.name].concat((layer.sublayers || []).reduce((list, sublayer) => {
            return list.concat([...this.getSublayerNames(sublayer)]);
        }, [])).filter(x => x);
    },
    mergeSubLayers(baselayer, addlayer, swipeActive=false) {
        addlayer = {...baselayer, sublayers: addlayer.sublayers};
        addlayer.externalLayerMap = addlayer.externalLayerMap || {};
        LayerUtils.extractExternalLayersFromSublayers(addlayer, addlayer);
        LayerUtils.addUUIDs(addlayer);
        if(isEmpty(addlayer.sublayers)) {
            return {...baselayer};
        }
        if(isEmpty(baselayer.sublayers)) {
            return addlayer;
        }
        let explodedBase = LayerUtils.explodeLayers([baselayer]);
        let existing = explodedBase.map(entry => entry.sublayer.name);
        let explodedAdd = LayerUtils.explodeLayers([addlayer]);
        explodedAdd = explodedAdd.filter(entry => !existing.includes(entry.sublayer.name));
        return LayerUtils.implodeLayers(explodedAdd.concat(explodedBase), swipeActive)[0];
    },
    searchSubLayer(layer, attr, value, path=[]) {
        if(layer.sublayers) {
            let idx = 0;
            for(let sublayer of layer.sublayers) {
                let match = sublayer[attr] === value ? sublayer : LayerUtils.searchSubLayer(sublayer, attr, value, path);
                if(match) {
                    path.unshift(idx);
                    return match;
                }
                idx += 1;
            }
        } else {
            if(layer[attr] === value) {
                return layer;
            }
        }
        return null;
    },
    sublayerVisible(layer, sublayerpath) {
        let visible = layer.visibility !== false;
        let sublayer = layer;
        for(let index of sublayerpath) {
            sublayer = sublayer.sublayers[index];
            visible &= sublayer.visibility !== false;
            if(!visible) {
                return false;
            }
        }
        return true;
    },
    cloneLayer(layer, sublayerpath) {
        let newlayer = assign({}, layer);
        let cur = newlayer;
        for(let i = 0; i < sublayerpath.length; ++i) {
            let idx = sublayerpath[i];
            cur.sublayers = [
                ...cur.sublayers.slice(0, idx),
                assign({}, cur.sublayers[idx]),
                ...cur.sublayers.slice(idx + 1)];
            cur = cur.sublayers[idx];
        }
        return {newlayer, newsublayer: cur};
    },
    collectGroupLayers(layer, parentGroups, groupLayers) {
        if(!isEmpty(layer.sublayers)) {
            for(let sublayer of layer.sublayers) {
                LayerUtils.collectGroupLayers(sublayer, parentGroups.concat(layer.name), groupLayers);
            }
        } else {
            for(let group of parentGroups) {
                groupLayers[group] = (groupLayers[group] || []).concat(layer.name);
            }
        }
    },
    replaceLayerGroups(layerConfigs, layer) {
        let groupLayers = {};
        LayerUtils.collectGroupLayers(layer, [], groupLayers);
        let newLayerConfigs = [];
        for(let layerConfig of layerConfigs) {
            if(layerConfig.name in groupLayers) {
                newLayerConfigs.push(...groupLayers[layerConfig.name].map(name => ({...layerConfig, name})));
            } else {
                newLayerConfigs.push(layerConfig);
            }
        }
        return newLayerConfigs;
    },
    extractExternalLayersFromSublayers(toplayer, layer) {
        if(layer.sublayers) {
            layer.sublayers = layer.sublayers.map(sublayer => {
                if(sublayer.externalLayer) {
                    let externalLayer = assign(
                        {},
                        sublayer.externalLayer,
                        {
                            title: sublayer.externalLayer.title || sublayer.externalLayer.name,
                            uuid: uuid.v4()
                        }
                    );
                    if(externalLayer.type === "wms") {
                        externalLayer.featureInfoUrl = externalLayer.featureInfoUrl || externalLayer.url;
                        externalLayer.legendUrl = externalLayer.legendUrl || externalLayer.url;
                        externalLayer.queryLayers = externalLayer.queryLayers || externalLayer.params.LAYERS.split(",");

                        let externalLayerFeatureInfoFormats = ConfigUtils.getConfigProp("externalLayerFeatureInfoFormats") || {};
                        for(let entry of Object.keys(externalLayerFeatureInfoFormats)) {
                            if(externalLayer.featureInfoUrl.toLowerCase().includes(entry.toLowerCase())) {
                                externalLayer.infoFormats = [externalLayerFeatureInfoFormats[entry]];
                                break;
                            }
                        }
                    }
                    toplayer.externalLayerMap[sublayer.name] = externalLayer;
                    sublayer = assign({}, sublayer);
                    delete sublayer["externalLayer"];
                }
                if(sublayer.sublayers) {
                    LayerUtils.extractExternalLayersFromSublayers(toplayer, sublayer);
                }
                return sublayer;
            });
        }
    },
    getLegendUrl(layer, sublayer, scale, projection, map) {
        let params = "SERVICE=WMS"
                   + "&REQUEST=GetLegendGraphic"
                   + "&VERSION=" + (layer.version || "1.3.0")
                   + "&FORMAT=image/png"
                   + "&LAYER=" + encodeURIComponent(sublayer.name)
                   + "&CRS=" + projection
                   + "&SCALE=" + Math.round(scale)
                   + "&SLD_VERSION=1.1.0";
        if(map) {
            params += "&WIDTH=" + map.size.width
                    + "&HEIGHT=" + map.size.height
                    + "&BBOX=" + map.bbox.bounds.join(",");
        }
        let requestUrl = layer.legendUrl;
        if(layer.externalLayerMap && layer.externalLayerMap[sublayer.name]) {
            requestUrl = layer.externalLayerMap[sublayer.name].legendUrl;
        }
        if (!requestUrl) {
            return "";
        }
        return requestUrl + (requestUrl.indexOf('?') === -1 ? '?' : '&') + params;
    }
};

module.exports = LayerUtils;

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
            if(layerConfig.type !== 'theme') {
                external = external.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers));
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
            } else {
                reordered = reordered.concat(LayerUtils.createExternalLayerPlaceholder(layerConfig, externalLayers));
            }
        }
        LayerUtils.insertPermalinkLayers(reordered, permalinkLayers);
        return LayerUtils.implodeLayers(reordered);
    },
    createExternalLayerPlaceholder: function(layerConfig, externalLayers) {
        let key = layerConfig.type + ":" + layerConfig.url;
        (externalLayers[key] = externalLayers[key] || []).push({
            name: layerConfig.name,
            opacity: layerConfig.opacity,
            visibility: layerConfig.visibility
        });
        return LayerUtils.explodeLayers([{
            type: "placeholder",
            title: layerConfig.name,
            role: LayerRole.USERLAYER,
            loading: true,
            source: layerConfig.type + ':' + layerConfig.url + '#' + layerConfig.name,
            refid: uuid.v4(),
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
                params: assign({}, layer.params || {LAYERS: layer.name}, {MAP: query.map}),
                queryLayers: [layer.name]
            };
        }
        let layerNames = [];
        let opacities = [];
        let queryable = [];
        layer.sublayers.map(sublayer => {
            LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, queryable);
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
            MAP: query.map
        });
        return {
            params: newParams,
            queryLayers: queryable
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
            } else if(layer.role === LayerRole.USERLAYER && (layer.type === "wms" || layer.type === "wfs")) {
                layernames.push(layer.type + ':' + layer.url + "#" + layer.name);
                opacities.push(layer.opacity);
                visibilities.push(layer.visibility);
            }
        }
        return layernames.map((layername, idx) => {
            let param = layername;
            if(opacities[idx] < 255){
                param += "[" + (100 - Math.round(opacities[idx] / 255. * 100)) + "]";
            }
            if(!visibilities[idx]) {
                param += '!';
            }
            return param;
        }).join(",");
    },
    splitLayerUrlParam(entry) {
        const nameOpacityPattern = /([^\[]+)\[(\d+)]/;
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
        if(name.search(/^w(m|f)s:/) != -1) {
            let pos = name.lastIndexOf('#');
            type = name.slice(0, 3);
            url = name.slice(4, pos);
            name = name.slice(pos + 1);
        }
        return {type, url, name, opacity, visibility};
    },
    removeLayer(layers, layer, sublayerpath, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        const pathEqualOrBelow = (parent, child) => {
            if(child.length < parent.length) {
                return false;
            }
            if(parent.length === 0) {
                return true;
            }
            for(let i = 0, n = parent.length; i < n; ++i) {
                if(parent[i] != child[i]) {
                    return false;
                }
            }
            return true;
        }
        // Remove matching entries
        exploded = exploded.filter(entry => entry.layer.uuid !== layer.uuid || !pathEqualOrBelow(sublayerpath, entry.path));
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
    reorderLayer(layers, movelayer, sublayerpath, delta, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.role !== LayerRole.BACKGROUND);
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Find entry to move
        if(movelayer) {
            let idx = exploded.findIndex(entry => {
                return entry.layer.uuid === movelayer.uuid && isEqual(entry.path, sublayerpath);
            });
            if(idx === -1) {
                return layers;
            }
            // Reorder layer
            let destidx = idx + delta;
            if(destidx < 0 || destidx >= exploded.length) {
                return layers;
            }
            let entry = exploded.splice(idx, 1)[0];
            exploded.splice(destidx, 0, entry);
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
            if(target && target.sublayers && target.refid === layer.refid) {
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
        if(swipeLayer) {
            newlayers.unshift(swipeLayer);
        }
        return newlayers;
    },
    ensureMutuallyExclusive(group) {
        if(group.sublayers) {
            let visibleChild = null;
            for(let child of group.sublayers) {
                if(!visibleChild && child.visibility) {
                    visibleChild = child;
                } else if(group.mutuallyExclusive && visibleChild) {
                    child.visibility = false;
                }
                LayerUtils.ensureMutuallyExclusive(child);
            }
            if(group.mutuallyExclusive && !visibleChild) {
                group.sublayers[0].visibility = true;
            }
        }
    },
    getSublayerNames(layer) {
        return (layer.sublayers || []).reduce((list, sublayer) => {
            return list.concat([sublayer.name, ...this.getSublayerNames(sublayer)]);
        }, []);
    },
    mergeSubLayers(baselayer, addlayer, swipeActive=false) {
        if(isEmpty(addlayer.sublayers)) {
            return {...baselayer};
        }
        LayerUtils.addUUIDs(addlayer);
        let explodedBase = LayerUtils.explodeLayers([baselayer]);
        let existing = explodedBase.map(entry => entry.sublayer.name);
        let explodedAdd = LayerUtils.explodeLayers([{...baselayer, sublayers: addlayer.sublayers}]);
        explodedAdd = explodedAdd.filter(entry => !existing.includes(entry.sublayer.name));
        return LayerUtils.implodeLayers(explodedBase.concat(explodedAdd), swipeActive)[0];
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
    }
};

module.exports = LayerUtils;

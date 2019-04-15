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
    restoreVisibleLayers: function(sublayers, initiallayers, initialopacities) {
        let newsublayers = sublayers.slice(0);
        newsublayers.map((sublayer, idx) => {
            if(sublayer.sublayers) {
                // Is group
                newsublayers[idx] = assign({}, sublayer, {sublayers: LayerUtils.restoreVisibleLayers(sublayer.sublayers, initiallayers, initialopacities)});
            } else {
                let idx2 = initiallayers.indexOf(sublayer.name);
                newsublayers[idx] = assign({}, sublayer, {
                    visibility: idx2 >= 0,
                    opacity: idx2 >= 0 ? initialopacities[idx2] : sublayer.opacity
                });
            }
        });
        return newsublayers;
    },
    restoreReorderedVisibleLayers: function(sublayers, initiallayers, initialopacities) {
        let exploded = LayerUtils.explodeLayers([{sublayers: sublayers}]);
        // Reorder according to order in initiallayers
        let reordered = 0;
        for(let i = 0; i < initiallayers.length; ++i) {
            let idx = exploded.slice(reordered).findIndex(entry => entry.sublayer.name === initiallayers[i]);
            if(idx != -1) {
                idx += reordered;
                let entry = exploded.splice(idx, 1)[0];
                exploded.splice(0, 0, entry);
                entry.sublayer.opacity = initialopacities[i];
                entry.sublayer.visibility = true;
                ++reordered;
            }
        }
        // All non-reordered entries correspond to layers which were not in the initiallayers list: mark them hidden
        for(let i = reordered; i < exploded.length; ++i) {
            exploded[i].sublayer.visibility = false;
        }
        // Re-assemble layers
        return LayerUtils.implodeLayers(exploded)[0].sublayers;
    },
    collectWMSSublayerParams: function(sublayer, layerNames, opacities, queryable) {
        let visibility = sublayer.visibility === undefined ? true : sublayer.visibility;
        if(visibility) {
            if(!isEmpty(sublayer.sublayers)) {
                // Is group
                sublayer.sublayers.map(sublayer => {
                    LayerUtils.collectWMSSublayerParams(sublayer, layerNames, opacities, queryable)
                });
            } else {
                layerNames.push(sublayer.name);
                opacities.push(Number.isInteger(sublayer.opacity) ? sublayer.opacity : 255);
                if(sublayer.queryable) {
                    queryable.push(sublayer.name)
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
    addSublayerIDs(group) {
        if(!isEmpty(group.sublayers)) {
            assign(group, {sublayers: group.sublayers.slice(0)});
            for(let i = 0; i < group.sublayers.length; ++i) {
                group.sublayers[i] = assign({}, group.sublayers[i], {
                    refid: group.sublayers[i].refid || uuid.v4(), // refid is used by re-ordering to recognize equal groups
                    uuid: group.sublayers[i].uuid || uuid.v4() // uuid is guaranteed unique
                });
                LayerUtils.addSublayerIDs(group.sublayers[i]);
            }
        }
    },
    buildWMSLayerUrlParam(layers) {
        let layernames = [];
        let opacities = [];
        for(let layer of layers) {
            if(layer.role === LayerRole.THEME) {
                layernames.push(...layer.params.LAYERS.split(","));
                opacities.push(...(layer.params.OPACITIES || "").split(",").map(entry => parseFloat(entry)));
            } else if(layer.role === LayerRole.USERLAYER && (layer.type === "wms" || layer.type === "wfs")) {
                layernames.push(layer.type + ':' + layer.url + "#" + layer.name);
                opacities.push(layer.opacity);
            }
        }
        return layernames.map((layername, idx) => {
            if(idx < opacities.length && opacities[idx] < 255){
                return layername + "[" + (100 - Math.round(opacities[idx] / 255. * 100)) + "]";
            } else {
                return layername;
            }
        }).join(",");
    },
    splitLayerUrlParam(entry) {
        const nameOpacityPattern = /([^\[]+)\[(\d+)]/;
        let type = 'theme';
        let url = null;
        let name = entry;
        let opacity = 255;
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
        return {type, url, name, opacity};
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
        exploded = exploded.filter(entry => entry.layer !== layer || !pathEqualOrBelow(sublayerpath, entry.path));
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
                return entry.layer === movelayer && isEqual(entry.path, sublayerpath);
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
                exploded.push({layer: layer, path: [], sublayer: layer});
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
                exploded.push({layer: layer, path: path, sublayer: parent.sublayers[idx]})
            }
        }
    },
    implodeLayer(exploded) {
        let layer = assign({}, exploded.layer);

        // Populate the layer with the single sublayer
        let group = layer;
        for(let idx of exploded.path) {
            // Assign a new uuids to groups
            assign(group, {uuid: uuid.v4()});
            group.sublayers = [assign({}, group.sublayers[idx])];
            group = group.sublayers[0];
        }
        return layer;
    },
    implodeLayers(exploded, swipeActive=false) {
        let newlayers = [];

        // If swipe is active, keep first layer separate
        let swipeLayer = null;
        if(swipeActive && exploded.length > 0) {
            swipeLayer = LayerUtils.implodeLayer(exploded.shift());
        }

        // Merge all possible items of an exploded layer array
        for(let entry of exploded) {
            let layer = LayerUtils.implodeLayer(entry);

            // Attempt to merge with previous if possible
            let target = newlayers.length > 0 ? newlayers[newlayers.length - 1] : null;
            let source = layer;
            if(target && target.sublayers && target.refid === layer.refid) {
                let innertarget = target.sublayers[target.sublayers.length - 1];
                let innersource = source.sublayers[0]; // Exploded entries have only one entry per sublayer level
                while(innertarget.sublayers && innertarget.refid === innersource.refid) {
                    target = innertarget;
                    source = innersource;
                    innertarget = target.sublayers[target.sublayers.length - 1];
                    innersource = source.sublayers[0]; // Exploded entries have only one entry per sublayer level
                }
                target.sublayers.push(source.sublayers[0]);
            } else {
                newlayers.push(layer);
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
    mergeSubLayers(baselayer, addlayer) {
        let newlayer = assign({}, baselayer);
        if(addlayer.sublayers) {
            assign(newlayer, {sublayers: (newlayer.sublayers || []).slice(0)});
            for(let addsublayer of addlayer.sublayers) {
                let idx = newlayer.sublayers.findIndex(sublayer => sublayer.name === addsublayer.name);
                if(idx === -1) {
                    newlayer.sublayers.unshift(addsublayer);
                } else {
                    newlayer.sublayers[idx] = LayerUtils.mergeSubLayers(newlayer.sublayers[idx], addsublayer);
                }
            }
        }
        return newlayer;
    },
    searchSubLayer(layer, attr, value, path=[]) {
        if(layer.sublayers) {
            let idx = 0;
            for(let sublayer of layer.sublayers) {
                let subsublayer = LayerUtils.searchSubLayer(sublayer, attr, value, path);
                if(subsublayer) {
                    path.unshift(idx);
                    return subsublayer;
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

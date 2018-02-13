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
        // Ids are required for re-grouping
        let dummylayer = {sublayers: sublayers};
        LayerUtils.addSublayerIDs(dummylayer);
        let exploded = LayerUtils.explodeLayers([dummylayer]);
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
                opacities.push(sublayer.opacity || 255);
                if(sublayer.queryable) {
                    queryable.push(sublayer.name)
                }
            }
        }
    },
    buildWMSLayerParams: function(layer) {
        if(!Array.isArray(layer.sublayers)) {
            return {
                params: {LAYERS: layer.name},
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
        return {
            params: {
                LAYERS: layerNames.join(","),
                OPACITIES: opacities.join(",")
            },
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
            if(layer.isThemeLayer) {
                layernames.push(...layer.params.LAYERS.split(","));
                opacities.push(...(layer.params.OPACITIES || "").split(",").map(entry => parseFloat(entry)));
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
    removeLayer(layers, layer, sublayerpath, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.group !== 'background');
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
        // Re-add background layers
        return [
            ...newlayers,
            ...layers.filter(layer => layer.group === "background")
        ];
    },
    reorderLayer(layers, movelayer, sublayerpath, delta, swipeActive) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.group !== 'background');
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
            ...layers.filter(layer => layer.group === "background")
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
    implodeLayers(exploded, swipeActive=false) {
        // Merge all possible items of an exploded layer array
        let newlayers = [];
        let usedUuidIds = new Set();
        for(let entry of exploded) {
            let layer = assign({}, entry.layer);
            // Assign a new uuid to the layer if it is a group
            if(!isEmpty(layer.sublayers)) {
                if(usedUuidIds.has(layer.uuid)) {
                    assign(layer, {uuid: uuid.v4()});
                }
                usedUuidIds.add(layer.uuid);
            }
            // Populate the layer with the single sublayer
            let cursublayer = layer;
            for(let idx of entry.path) {
                cursublayer.sublayers = [assign({}, cursublayer.sublayers[idx])];
                cursublayer = cursublayer.sublayers[0];
            }
            // Merge with previous if possible
            if(newlayers.length > (swipeActive ? 1 : 0) && newlayers[newlayers.length - 1].refid === layer.refid) {
                let target = newlayers[newlayers.length - 1];
                let group = layer;
                let targetgroup = target;
                while(group.sublayers) {
                    if(!targetgroup.sublayers || targetgroup.sublayers[targetgroup.sublayers.length -1].refid != group.sublayers[0].refid) {
                        // Assign new uuids to groups to avoid react moaning about same keys, but not to leaf nodes
                        let g = group.sublayers[0];
                        while(g.sublayers) {
                            if(usedUuidIds.has(g.uuid)) {
                                assign(g, {uuid: uuid.v4()});
                            }
                            usedUuidIds.add(g.uuid);
                            g = g.sublayers[0];
                        }

                        targetgroup.sublayers.push(group.sublayers[0]);
                        break;
                    }
                    group = group.sublayers[0];
                    targetgroup = targetgroup.sublayers[targetgroup.sublayers.length -1];
                }
            } else {
                newlayers.push(layer);
            }
        }
        return newlayers;
    }
};

module.exports = LayerUtils;

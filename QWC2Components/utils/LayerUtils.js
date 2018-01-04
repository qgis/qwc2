/**
* Copyright 2016, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const assign = require('object-assign');
const {isEmpty,isEqual} = require('lodash');
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
            if(sublayer.sublayers) {
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
        if(isEmpty(layer.sublayers)) {
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
        if(group.sublayers) {
            for(let i = 0; i < group.sublayers.length; ++i) {
                group.sublayers[i] = assign({}, group.sublayers[i], {
                    refid: uuid.v4(), // refid is used by re-ordering to recognize equal groups
                    uuid: uuid.v4() // uuid is guaranteed unique
                });
                LayerUtils.addSublayerIDs(group.sublayers[i]);
            }
        }
    },
    buildWMSLayerUrlParam(layers) {
        let layernames = [];
        let opacities = [];
        for(let layer of layers.slice(0).reverse()) {
            if(layer.isThemeLayer) {
                layernames.push(...layer.params.LAYERS.split(","));
                opacities.push(...layer.params.OPACITIES.split(",").map(entry => parseFloat(entry)));
            }
        }
        return layernames.map((layername, idx) => {
            if(opacities[idx] < 255){
                return layername + "[" + (100 - Math.round(opacities[idx] / 255. * 100)) + "]";
            } else {
                return layername;
            }
        }).join(",");
    },
    getWMSLegendGraphicURL(layer, sublayer) {
        let version = layer.params.VERSION || "1.3.0";
        return layer.url + "?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=" + version + "&FORMAT=image/png&LAYER=" + sublayer;
    },
    reorderLayer(layers, movelayer, sublayerpath, delta) {
        // Extract foreground layers
        let fglayers = layers.filter(layer => layer.group !== 'background');
        // Explode layers (one entry for every single sublayer)
        let exploded = LayerUtils.explodeLayers(fglayers);
        // Find entry to move
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
        // Re-assemble layers
        let newlayers = LayerUtils.implodeLayers(exploded);
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
            if(layer.sublayers) {
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
    implodeLayers(exploded) {
        // Merge all possible items of an exploded layer array
        let newlayers = [];
        for(let entry of exploded) {
            let layer = assign({}, entry.layer);
            // Assign a new uuid to the layer if it is a group
            if(layer.sublayers) {
                assign(layer, {uuid: uuid.v4()});
            }
            // Populate the layer with the single sublayer
            let cursublayer = layer;
            for(let idx of entry.path) {
                cursublayer.sublayers = [assign({}, cursublayer.sublayers[idx])];
                cursublayer = cursublayer.sublayers[0];
            }
            // Merge with previous if possible
            if(newlayers.length > 0 && newlayers[newlayers.length - 1].refid === layer.refid) {
                let target = newlayers[newlayers.length - 1];
                let group = layer;
                let targetgroup = target;
                while(group.sublayers) {
                    if(!targetgroup.sublayers || targetgroup.sublayers[targetgroup.sublayers.length -1].refid != group.sublayers[0].refid) {
                        // Assign new uuids to groups to avoid react moaning about same keys, but not to leaf nodes
                        let g = group.sublayers[0];
                        while(g.sublayers) {
                            assign(g, {uuid: uuid.v4()});
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

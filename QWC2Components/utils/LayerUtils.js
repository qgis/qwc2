/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');

 const LayerUtils = {
     restoreVisibleLayers: function(sublayers, initiallayers, initialopacities) {
         let newsublayers = sublayers.splice(0);
         newsublayers.map((sublayer, idx) => {
             if(sublayer.sublayers) {
                  // Is group
                  newsublayers[idx] = assign({}, sublayer, {sublayers: LayerUtils.restoreVisibleLayers(sublayer.sublayers, initiallayers, initialopacities)});
             } else {
                 let idx = initiallayers.indexOf(sublayer.name);
                 newsublayers[idx] = assign({}, sublayer, {
                     visibility: idx >= 0,
                     opacity: idx >= 0 ? initialopacities[idx] : sublayer.opacity
                 });
             }
         });
         return newsublayers;
     },
     buildLayerParams: function(sublayers, drawingOrder) {
        let layerNames = [];
        let opacities = [];
        let queryable = [];
        (sublayers || []).map(sublayer => {
            LayerUtils.parseSublayer(sublayer, layerNames, opacities, queryable);
        });
        layerNames.reverse();
        opacities.reverse();
        if(drawingOrder && drawingOrder.length > 0) {
            let indices = drawingOrder.map(layer => layerNames.indexOf(layer)).filter(idx => idx >= 0);
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
    parseSublayer: function(sublayer, layerNames, opacities, queryable) {
        let visibility = sublayer.visibility === undefined ? true : sublayer.visibility;
        if(visibility) {
            if(sublayer.sublayers) {
                // Is group
                sublayer.sublayers.map(sublayer => {
                    LayerUtils.parseSublayer(sublayer, layerNames, opacities, queryable)
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
    constructUrlParam(layer) {
        let layers = layer.params.LAYERS.split(",");
        let opacities = layer.params.OPACITIES.split(",").map(entry => parseFloat(entry));
        return layers.map((entry, idx) => {
            if(opacities[idx] < 255){
                return entry + "[" + (100 - Math.round(opacities[idx] / 255. * 100)) + "]";
            } else {
                return entry;
            }
        }).join(",");
    }
 };

 module.exports = LayerUtils;

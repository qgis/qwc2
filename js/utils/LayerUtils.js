/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');

 const LayerUtils = {
     restoreVisibleLayers: function(sublayers, visiblelayers) {
         let newsublayers = sublayers.splice(0);
         newsublayers.map((sublayer, idx) => {
             if(sublayer.sublayers) {
                  // Is group
                  newsublayers[idx] = assign({}, sublayer, {sublayers: LayerUtils.restoreVisibleLayers(sublayer.sublayers, visiblelayers)});
             } else {
                 newsublayers[idx] = assign({}, sublayer, {visiblity: visiblelayers.includes(sublayer.name)});
             }
         });
         return newsublayers;
     },
     buildLayerParams: function(sublayers) {
        let layerNames = [];
        let opacities = [];
        let queryable = [];
        (sublayers || []).map(sublayer => {
            LayerUtils.parseSublayer(sublayer, layerNames, opacities, queryable);
        });
        return {
            LAYERS: layerNames.reverse().join(","),
            OPACITIES: opacities.reverse().join(","),
            query_layers: queryable
        }
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
    }
 };

 module.exports = LayerUtils;

/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import layerinfoReducer from '../reducers/layerinfo';
ReducerIndex.register("layerinfo", layerinfoReducer);

export const SET_ACTIVE_LAYERINFO = 'SET_ACTIVE_LAYERINFO';


/**
 * Sets the current layer and sub-layer in the store.
 * 
 * It changes the `layer` and `sublayer` properties of the store.
 * 
 * @param {string} layer - the layer to mark as being the active one.
 * @param {string} sublayer - a sublayer of the active layer
 *  to mark as the active one.
 * 
 * @group Redux Store.Actions
 */
export function setActiveLayerInfo(layer, sublayer) {
    return {
        type: SET_ACTIVE_LAYERINFO,
        layer: layer,
        sublayer: sublayer
    };
}

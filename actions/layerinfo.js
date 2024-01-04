/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import layerinfoReducer from '../reducers/layerinfo';
ReducerIndex.register("layerinfo", layerinfoReducer);

export const SET_ACTIVE_LAYERINFO = 'SET_ACTIVE_LAYERINFO';

export function setActiveLayerInfo(layer, sublayer) {
    return {
        type: SET_ACTIVE_LAYERINFO,
        layer: layer,
        sublayer: sublayer
    };
}

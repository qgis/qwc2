/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import layerinfoReducer from '../reducers/layerinfo';
ReducerRegistry.register("layerinfo", layerinfoReducer);

export const SET_ACTIVE_LAYERINFO = 'SET_ACTIVE_LAYERINFO';

export function setActiveLayerInfo(layer, sublayer) {
    return {
        type: SET_ACTIVE_LAYERINFO,
        layer: layer,
        sublayer: sublayer
    };
}

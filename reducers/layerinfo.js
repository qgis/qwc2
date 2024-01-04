/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_ACTIVE_LAYERINFO} from '../actions/layerinfo';

const defaultState = {};

export default function layerInfo(state = defaultState, action) {
    switch (action.type) {
    case SET_ACTIVE_LAYERINFO: {
        return {...state, layer: action.layer, sublayer: action.sublayer};
    }
    default:
        return state;
    }
}

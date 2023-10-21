/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SET_ACTIVE_LAYERINFO } from '../actions/layerinfo';

/**
 * @typedef {object} LayerInfoState
 * @property {string|null} layer - the active layer
 * @property {string[]|null} sublayer - the active sublayer
 */


/**
 * @type {LayerInfoState}
 * @private
 */
const defaultState = {
    layer: null,
    sublayer: null
};


export default function layerInfo(
    state = defaultState, action
) {
    switch (action.type) {
        case SET_ACTIVE_LAYERINFO: {
            return {
                ...state,
                layer: action.layer,
                sublayer: action.sublayer
            };
        }
        default:
            return state;
    }
}

/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_VISIBLE_LEGENDWINDOW} from '../actions/legendwindow';

const defaultState = {};

export default function legendWindow(state = defaultState, action) {
    switch (action.type) {
    case SET_VISIBLE_LEGENDWINDOW: {
        return {...state, layers: action.layers, visible: action.visible};
    }
    default:
        return state;
    }
}

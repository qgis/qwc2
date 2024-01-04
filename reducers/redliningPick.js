/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_REDLINING_PICK_STATE} from '../actions/redliningPick';

const defaultState = {
    active: false,
    selectedFeatures: [],
    layer: 'redlining'
};

export default function redliningPick(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_REDLINING_PICK_STATE: {
        return {...state, ...action.data};
    }
    default:
        return state;
    }
}

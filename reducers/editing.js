/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_EDITING_STATE} from '../actions/editing';

const defaultState = {
    action: null,
    geomType: null,
    feature: null
};

export default function editing(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_EDITING_STATE: {
        const changed = action.data.feature && action.data.changed !== false;
        return {...state, ...action.data, changed: changed};
    }
    default:
        return state;
    }
}

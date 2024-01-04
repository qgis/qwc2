/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_CURRENT_TASK, SET_CURRENT_TASK_BLOCKED} from '../actions/task';

const defaultState = {
    id: null,
    mode: null,
    data: null,
    blocked: false,
    unsetOnMapClick: false
};

export default function task(state = defaultState, action) {
    switch (action.type) {
    case SET_CURRENT_TASK: {
        if (state.blocked) {
            return state;
        }
        return {...state, id: action.id, mode: action.mode, data: action.data, unsetOnMapClick: action.unsetOnMapClick};
    }
    case SET_CURRENT_TASK_BLOCKED: {
        return {...state, blocked: action.blocked};
    }
    default:
        return state;
    }
}

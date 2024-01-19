/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_IDENTIFY_TOOL, OPEN_IDENTIFY_TOOL, SET_FORCE_OPEN} from '../actions/identify';

const defaultState = {
    tool: null
};

export default function identify(state = defaultState, action) {
    switch (action.type) {
    case SET_IDENTIFY_TOOL: {
        return {...state, tool: action.tool};
    }
    case OPEN_IDENTIFY_TOOL: {
        return {...state, tool: 'Identify', forceOpen: action.forceOpen};
    }
    case SET_FORCE_OPEN: {
        return {...state, forceOpen: action.forceOpen};
    }
    default:
        return state;
    }
}

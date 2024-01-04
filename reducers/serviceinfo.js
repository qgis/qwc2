/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_ACTIVE_SERVICEINFO} from '../actions/serviceinfo';

const defaultState = {};

export default function serviceInfo(state = defaultState, action) {
    switch (action.type) {
    case SET_ACTIVE_SERVICEINFO: {
        return {...state, service: action.service};
    }
    default:
        return state;
    }
}

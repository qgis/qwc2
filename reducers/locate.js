/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_LOCATE_STATE, CHANGE_LOCATE_POSITION, LOCATE_ERROR} from '../actions/locate';

const defaultState = {
    state: "DISABLED",
    position: null
};

export default function locate(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_LOCATE_STATE: {
        return {...state, state: action.state};
    }
    case CHANGE_LOCATE_POSITION: {
        return {...state, position: action.position};
    }
    case LOCATE_ERROR: {
        return {...state, error: action.error};
    }
    default:
        return state;
    }
}

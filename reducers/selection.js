/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_SELECTION_STATE} from '../actions/selection';

const defaultState = {
    geomType: null,
    style: 'default',
    styleOptions: {},
    reset: false
};

export default function selection(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_SELECTION_STATE: {
        return {
            ...state,
            geomType: action.geomType,
            measure: action.measure || false,
            active: action.active ?? true,
            box: action.box,
            circle: action.circle,
            point: action.point,
            line: action.line,
            polygon: action.polygon,
            style: action.style || 'default',
            styleOptions: action.styleOptions || {},
            cursor: action.cursor || null,
            reset: action.reset || false
        };
    }
    default:
        return state;
    }
}

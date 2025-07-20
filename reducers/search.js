/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    SET_CURRENT_SEARCH_RESULT
} from '../actions/search';

const defaultState = {
    currentResult: null
};

export default function processNotifications(state = defaultState, action) {
    switch (action.type) {
    case SET_CURRENT_SEARCH_RESULT: {
        return {
            currentResult: action.currentResult
        };
    }
    default:
        return state;
    }
}

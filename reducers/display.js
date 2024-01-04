/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {TOGGLE_FULLSCREEN} from '../actions/display';

const defaultState = {
    fullscreen: false
};

export default function toggleFullscreen(state = defaultState, action) {
    switch (action.type) {
    case TOGGLE_FULLSCREEN: {
        return {...state, fullscreen: action.fullscreen};
    }
    default:
        return state;
    }
}

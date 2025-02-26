/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {TOGGLE_FULLSCREEN, SET_VIEW_3D_MODE} from '../actions/display';

const defaultState = {
    fullscreen: false,
    view3dMode: 0

};

export default function toggleFullscreen(state = defaultState, action) {
    switch (action.type) {
    case TOGGLE_FULLSCREEN: {
        return {...state, fullscreen: action.fullscreen};
    }
    case SET_VIEW_3D_MODE: {
        return {...state, view3dMode: action.mode};
    }
    default:
        return state;
    }
}

/**
 * Copyright 2025 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    SET_BOOKMARKS,
    SET_VISIBILITY_PRESETS
} from '../actions/bookmark';

const defaultState = {
    bookmarks: [],
    visibilityPresets: []
};

export default function bookmark(state = defaultState, action) {
    switch (action.type) {
    case SET_BOOKMARKS: {
        return {...state, bookmarks: action.bookmarks};
    }
    case SET_VISIBILITY_PRESETS: {
        return {...state, visibilityPresets: action.visibilityPresets};
    }
    default:
        return state;
    }
}

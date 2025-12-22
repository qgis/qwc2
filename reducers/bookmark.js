/**
 * Copyright 2025 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    SET_BOOKMARKS
} from '../actions/bookmark';

const defaultState = {
    bookmarks: []
};

export default function bookmark(state = defaultState, action) {
    switch (action.type) {
    case SET_BOOKMARKS: {
        return {...state, bookmarks: action.bookmarks};
    }
    default:
        return state;
    }
}

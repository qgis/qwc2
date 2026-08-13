/**
 * Copyright 2025 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import bookmarkReducer from '../reducers/bookmark';
import ReducerIndex from '../reducers/index';

ReducerIndex.register("bookmark", bookmarkReducer);

export const SET_BOOKMARKS = 'SET_BOOKMARKS';
export const SET_VISIBILITY_PRESETS = 'SET_VISIBILITY_PRESETS';

export function setBookmarks(bookmarks) {
    return {
        type: SET_BOOKMARKS,
        bookmarks
    };
}

export function setVisibilityPresets(visibilityPresets) {
    return {
        type: SET_VISIBILITY_PRESETS,
        visibilityPresets
    };
}
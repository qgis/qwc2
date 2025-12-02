/**
 * Copyright 2025 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';

import bookmarkReducer from '../reducers/bookmark';
import ReducerIndex from '../reducers/index';
import ConfigUtils from '../utils/ConfigUtils';
ReducerIndex.register("bookmark", bookmarkReducer);

export const SET_BOOKMARKS = 'SET_BOOKMARKS';

export function setBookmarks(bookmarks) {
    return {
        type: SET_BOOKMARKS,
        bookmarks
    };
}

export function refreshUserBookmarks() {
    return (dispatch, getState) => {
        const username = ConfigUtils.getConfigProp("username");
        const permalinkServiceUrl = ConfigUtils.getConfigProp("permalinkServiceUrl");
        if (username && permalinkServiceUrl) {
            axios.get(permalinkServiceUrl.replace(/\/$/, '') + "/bookmarks/")
                .then(response => {
                    dispatch(setBookmarks(response.data || []));
                })
                .catch(() => {
                    dispatch(setBookmarks([]));
                });
        }
    };
}

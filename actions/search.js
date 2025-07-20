/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import searchReducer from '../reducers/search';
ReducerIndex.register("search", searchReducer);

export const SET_CURRENT_SEARCH_RESULT = 'SET_CURRENT_SEARCH_RESULT';

export function setCurrentSearchResult(result) {
    return {
        type: SET_CURRENT_SEARCH_RESULT,
        result
    };
}

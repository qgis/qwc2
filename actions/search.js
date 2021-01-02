/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import searchReducer from '../reducers/search';
ReducerIndex.register("search", searchReducer);

import uuid from 'uuid';

export const SEARCH_CHANGE = 'SEARCH_CHANGE';
export const SEARCH_SET_REQUEST = 'SEARCH_SET_REQUEST';
export const SEARCH_ADD_RESULTS = 'SEARCH_ADD_RESULTS';
export const CLEAR_SEARCH = 'CLEAR_SEARCH';
export const SEARCH_SET_CURRENT_RESULT = 'SEARCH_SET_CURRENT_RESULT';

export const SearchResultType = {
    PLACE: 0,
    THEMELAYER: 1,
    THEME: 2,
    EXTERNALLAYER: 3
};

export function clearSearch() {
    return {
        type: CLEAR_SEARCH
    };
}

export function changeSearch(text, providers) {
    return {
        type: SEARCH_CHANGE,
        text: text || "",
        providers: providers
    };
}

export function startSearch(text, options, providers, startup = false) {
    return (dispatch, getState) => {
        const reqId = uuid.v1();
        const providerKeys = Object.keys(providers);
        dispatch({
            type: SEARCH_SET_REQUEST,
            id: reqId,
            providers: providerKeys,
            startup: startup
        });
        Object.keys(providers).map(provider => {
            providers[provider].onSearch(text, reqId, options, dispatch, getState());
        });
    };
}

export function searchMore(moreItem, text, providers) {
    return (dispatch) => {
        if (moreItem.provider && providers[moreItem.provider].getMoreResults) {
            const reqId = uuid.v1();
            dispatch({
                type: SEARCH_SET_REQUEST,
                id: reqId,
                providers: [moreItem.provider]
            });
            providers[moreItem.provider].getMoreResults(moreItem, text, reqId, dispatch);
        }
    };
}

export function addSearchResults(results, append = true) {
    return {
        type: SEARCH_ADD_RESULTS,
        results: results,
        append: append
    };
}

export function setCurrentSearchResult(result) {
    return {
        type: SEARCH_SET_CURRENT_RESULT,
        result: result
    };
}

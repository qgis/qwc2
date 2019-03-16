/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const CoordinatesUtils = require('../utils/CoordinatesUtils');
const uuid = require('uuid');

const SEARCH_CHANGE = 'SEARCH_CHANGE';
const SEARCH_SET_REQUEST = 'SEARCH_SET_REQUEST';
const SEARCH_ADD_RESULTS = 'SEARCH_ADD_RESULTS';
const CLEAR_SEARCH = 'CLEAR_SEARCH';
const SEARCH_SET_CURRENT_RESULT = 'SEARCH_SET_CURRENT_RESULT';

const SearchResultType = {
    PLACE: 0,
    THEMELAYER: 1,
    THEME: 2
};

function clearSearch() {
    return {
        type: CLEAR_SEARCH
    };
}

function changeSearch(text, providers) {
    return {
        type: SEARCH_CHANGE,
        text: text || "",
        providers: providers
    };
}

function startSearch(text, options, providers, startup=false) {
    return (dispatch, getState) => {
        let reqId = uuid.v1();
        let providerKeys = Object.keys(providers);
        dispatch({
            type: SEARCH_SET_REQUEST,
            id: reqId,
            providers: providerKeys,
            startup: startup
        });
        Object.keys(providers).map(provider => {
            providers[provider].onSearch(text, reqId, options, dispatch);
        });
    }
}

function searchMore(moreItem, text, providers) {
    return (dispatch) => {
        if(moreItem.provider && providers[moreItem.provider].getMoreResults) {
            let reqId = uuid.v1();
            dispatch({
                type: SEARCH_SET_REQUEST,
                id: reqId,
                providers: [moreItem.provider]
            });
            providers[moreItem.provider].getMoreResults(moreItem, text, reqId, dispatch);
        }
    };
}

function addSearchResults(results, append=true) {
    return {
        type: SEARCH_ADD_RESULTS,
        results: results,
        append: append
    };
}

function setCurrentSearchResult(result) {
    return {
        type: SEARCH_SET_CURRENT_RESULT,
        result: result
    };
}

module.exports = {
    SearchResultType,
    CLEAR_SEARCH,
    SEARCH_CHANGE,
    SEARCH_SET_REQUEST,
    SEARCH_ADD_RESULTS,
    SEARCH_SET_CURRENT_RESULT,
    clearSearch,
    changeSearch,
    startSearch,
    searchMore,
    addSearchResults,
    setCurrentSearchResult
};

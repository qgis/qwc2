/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TEXT_SEARCH_RESULTS_LOADED, resultsPurge} = require("../../MapStore2/web/client/actions/search");
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const UrlParams = require("../utils/UrlParams");

function startSearch(text, searchOptions, searchProviders, activeProviders) {
    UrlParams.updateParams({st: text});
    return (dispatch) => {
        dispatch(resultsPurge());
        if(searchProviders) {
            Object.keys(searchProviders).map(provider => {
                if(activeProviders.indexOf(provider) >= 0) {
                    searchProviders[provider].onSearch(text, searchOptions, dispatch)
                }
            });
        }
    }
}

function searchMore(moreItem, text, searchProviders) {
    return (dispatch) => {
        if(moreItem.provider && searchProviders[moreItem.provider].getMoreResults) {
            searchProviders[moreItem.provider].getMoreResults(moreItem, text, dispatch);
        }
    };
}

module.exports = {startSearch, searchMore};

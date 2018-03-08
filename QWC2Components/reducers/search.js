/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var {SEARCH_CHANGE, SEARCH_SET_REQUEST, SEARCH_ADD_RESULTS} = require('../actions/search');

const assign = require('object-assign');
const {UrlParams} = require("../utils/PermaLinkUtils");

function search(state = null, action) {
    switch (action.type) {
        case SEARCH_CHANGE:
            UrlParams.updateParams({st: action.text, sp: action.providers ? action.providers.join(",") : undefined});
            return {text: action.text, providers: action.providers};
        case SEARCH_SET_REQUEST:
            return assign({}, state, {requestId: action.id, pendingProviders: action.providers, startup: action.startup});
        case SEARCH_ADD_RESULTS:
            if(state.requestId !== action.results.reqId || !(state.pendingProviders || []).includes(action.results.provider)) {
                return state;
            }
            let results = action.results.data;
            if (action.append === true && state && state.results) {
                results = [...state.results, ...action.results.data];
            }
            let pendingProviders = state.pendingProviders.slice(0);
            pendingProviders.splice(pendingProviders.indexOf(action.results.provider), 1);
            return assign({}, state, { results: results, pendingProviders: pendingProviders });
        default:
            return state;
    }
}

module.exports = search;

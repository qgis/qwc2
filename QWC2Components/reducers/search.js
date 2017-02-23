/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var {SEARCH_CHANGE, SEARCH_SET_REQUEST, SEARCH_ADD_RESULTS, SEARCH_ADD_MARKER, SEARCH_SET_HIGHLIGHTED_FEATURE} = require('../actions/search');

const assign = require('object-assign');

function search(state = null, action) {
    switch (action.type) {
        case SEARCH_CHANGE:
            return {text: action.text, provider: action.provider};
        case SEARCH_SET_REQUEST:
            return assign({}, state, {requestId: action.id, pendingProviders: action.providers});
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
        case SEARCH_ADD_MARKER:
            return assign({}, state, { markerPosition: action.markerPosition, markerLabel: action.markerLabel });
        case SEARCH_SET_HIGHLIGHTED_FEATURE:
            return assign({}, state, {highlightedFeature: action.highlightedFeature});
        default:
            return state;
    }
}

module.exports = search;

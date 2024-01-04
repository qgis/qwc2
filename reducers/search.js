/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    SEARCH_CHANGE,
    SEARCH_SET_REQUEST,
    SEARCH_ADD_RESULTS,
    CLEAR_SEARCH,
    SEARCH_SET_CURRENT_RESULT
} from '../actions/search';
import {UrlParams} from '../utils/PermaLinkUtils';

const defaultState = {
    text: '',
    results: []
};

export default function search(state = defaultState, action) {
    switch (action.type) {
    case CLEAR_SEARCH: {
        return {...state, text: '', currentResult: null};
    }
    case SEARCH_CHANGE: {
        UrlParams.updateParams({st: action.text || undefined, sp: action.providers ? action.providers.join(",") : undefined});
        return {text: action.text, providers: action.providers};
    }
    case SEARCH_SET_REQUEST: {
        return {...state, requestId: action.id, pendingProviders: action.providers, startup: action.startup, results: []};
    }
    case SEARCH_ADD_RESULTS: {
        if (state.requestId !== action.reqId || !(state.pendingProviders || []).includes(action.provider)) {
            return state;
        }
        const results = [...state.results, ...action.results];
        results.sort((a, b) => {
            return (b.priority || 0) - (a.priority || 0);
        });
        const pendingProviders = state.pendingProviders.slice(0);
        pendingProviders.splice(pendingProviders.indexOf(action.provider), 1);
        return {...state, results: results, pendingProviders: pendingProviders};
    }
    case SEARCH_SET_CURRENT_RESULT: {
        return {...state, currentResult: action.result};
    }
    default:
        return state;
    }
}

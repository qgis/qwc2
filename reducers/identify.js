/**
 * Copyright 2017 Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
    IDENTIFY_EMPTY,
    IDENTIFY_RESPONSE,
    IDENTIFY_REQUEST,
    SET_IDENTIFY_ENABLED,
    PURGE_IDENTIFY_RESULTS
} = require('../actions/identify');

const assign = require('object-assign');

function identify(state = {enabled: true}, action) {
    switch (action.type) {
        case SET_IDENTIFY_ENABLED:
            return assign({}, state, {
                enabled: action.enabled
            });
        case PURGE_IDENTIFY_RESULTS:
            return assign({}, state, {
                responses: [],
                requests: []
            });
        case IDENTIFY_REQUEST: {
            const {reqId, request} = action;
            const requests = state.requests || [];
            return assign({}, state, {
                requests: [...requests, {reqId, request}]
            });
        }
        case IDENTIFY_RESPONSE: {
            const {reqId, request, data, error} = action;
            const responses = state.responses || [];
            return assign({}, state, {
                responses: [...responses, {reqId, request, data, error}]
            });
        }
        case IDENTIFY_EMPTY: {
            return assign({}, state, {
                requests: [{reqId: action.reqId, request: null}],
                responses: [{reqId: action.reqId, request: null, data: null}]
            });
        }
        default:
            return state;
    }
}

module.exports = identify;

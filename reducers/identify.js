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
    SET_IDENTIFY_TOOL,
    PURGE_IDENTIFY_RESULTS,
    SET_IDENTIFY_FEATURE_RESULT
} = require('../actions/identify');

const assign = require('object-assign');

function identify(state = {tool: null}, action) {
    switch (action.type) {
        case SET_IDENTIFY_TOOL:
            return assign({}, state, {
                tool: action.tool
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
            const {reqId, request, data, responseType, error} = action;
            const responses = state.responses || [];
            return assign({}, state, {
                responses: [...responses, {reqId, request, data, responseType, error}]
            });
        }
        case IDENTIFY_EMPTY: {
            return assign({}, state, {
                requests: [{reqId: action.reqId, request: null}],
                responses: [{reqId: action.reqId, request: null, data: null}]
            });
        }
        case SET_IDENTIFY_FEATURE_RESULT: {
            let request = {
                metadata: {layer: action.layername, pos: action.pos}
            }
            let data = {
                type: "FeatureCollection",
                features: [
                    // See IdentifyUtils.parseGeoJSONResponse
                    assign({}, action.feature, {id: action.layername + "." + action.feature.id})
                ]
            };
            return assign({}, state, {
                requests: [...(state.requests || []), {reqId: action.reqId, request}],
                responses: [...(state.responses || []), {reqId: action.reqId, request, data: data, responseType: 'application/json'}]
            })
        }
        default:
            return state;
    }
}

module.exports = identify;

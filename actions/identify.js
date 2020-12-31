/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import identifyReducer from '../reducers/identify';
ReducerRegistry.register("identify", identifyReducer);

import axios from 'axios';
import uuid from 'uuid';
import ConfigUtils from '../utils/ConfigUtils';

export const IDENTIFY_EMPTY = 'IDENTIFY_EMPTY';
export const IDENTIFY_RESPONSE = 'IDENTIFY_RESPONSE';
export const IDENTIFY_REQUEST = 'IDENTIFY_REQUEST';
export const SET_IDENTIFY_TOOL = 'SET_IDENTIFY_TOOL';
export const PURGE_IDENTIFY_RESULTS = 'PURGE_IDENTIFY_RESULTS';
export const SET_IDENTIFY_FEATURE_RESULT = 'SET_IDENTIFY_FEATURE_RESULT';


export function identifyEmpty() {
    return {
        type: IDENTIFY_EMPTY,
        reqId: uuid.v1()
    };
}

export function identifyResponse(reqId, request, data, error = null) {
    return {
        type: IDENTIFY_RESPONSE,
        reqId: reqId,
        request: request,
        data: data,
        responseType: request.params.info_format || request.params.outputformat,
        error: error
    };
}

export function identifyRequest(reqId, request) {
    return {
        type: IDENTIFY_REQUEST,
        reqId: reqId,
        request: request
    };
}

export function sendIdentifyRequest(request) {
    const reqId = uuid.v1();
    return (dispatch) => {
        dispatch(identifyRequest(reqId, request));
        axios.get(request.url, {params: request.params}).then((response) => {
            dispatch(identifyResponse(reqId, request, response.data));
        }).catch((e) => {
            dispatch(identifyResponse(reqId, request, null, e));
        });
    };
}

export function setIdentifyFeatureResult(pos, layername, feature) {
    return {
        type: SET_IDENTIFY_FEATURE_RESULT,
        reqId: uuid.v1(),
        pos: pos,
        layername: layername,
        feature: feature
    };
}

export function setIdentifyEnabled(enabled, theme = null) {
    return (dispatch, getState) => {
        let identifyTool = ConfigUtils.getConfigProp("identifyTool", theme || getState().theme.current);
        identifyTool = identifyTool !== undefined ? identifyTool : "Identify";
        dispatch({
            type: SET_IDENTIFY_TOOL,
            tool: enabled ? identifyTool : null
        });
    };
}

export function purgeIdentifyResults() {
    return {
        type: PURGE_IDENTIFY_RESULTS
    };
}

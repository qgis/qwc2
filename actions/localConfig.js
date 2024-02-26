/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import localConfigReducer from '../reducers/localConfig';
ReducerIndex.register("localConfig", localConfigReducer);

export const LOCAL_CONFIG_LOADED = 'LOCAL_CONFIG_LOADED';
export const SET_STARTUP_PARAMETERS = 'SET_STARTUP_PARAMETERS';
export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';
export const SET_USER_INFO_FIELDS = 'SET_USER_INFO_FIELDS';
export const SET_PERMALINK_PARAMETERS = 'SET_PERMALINK_PARAMETERS';

export function localConfigLoaded(config) {
    return {
        type: LOCAL_CONFIG_LOADED,
        config
    };
}

export function setStartupParameters(params) {
    return {
        type: SET_STARTUP_PARAMETERS,
        params
    };
}

export function setColorScheme(colorScheme, storeInLocalStorage = false) {
    return {
        type: SET_COLOR_SCHEME,
        colorScheme,
        storeInLocalStorage
    };
}

export function setUserInfoFields(fields) {
    return {
        type: SET_USER_INFO_FIELDS,
        fields
    };
}

export function setPermalinkParameters(params) {
    return {
        type: SET_PERMALINK_PARAMETERS,
        params
    };
}

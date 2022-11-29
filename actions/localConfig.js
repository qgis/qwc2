/**
 * Copyright 2016-2021 Sourcepole AG
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

export function setColorScheme(colorScheme) {
    return {
        type: SET_COLOR_SCHEME,
        colorScheme
    };
}

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import localConfigReducer from '../reducers/localConfig';
ReducerRegistry.register("localConfig", localConfigReducer);

export const LOCAL_CONFIG_LOADED = 'LOCAL_CONFIG_LOADED';
export const SET_STARTUP_PARAMETERS = 'SET_STARTUP_PARAMETERS';

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

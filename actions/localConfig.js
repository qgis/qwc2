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


/**
 * Load local config.
 * 
 * @param {object} config - The local config.
 * @memberof Redux Store.Actions
 */
export function localConfigLoaded(config) {
    return {
        type: LOCAL_CONFIG_LOADED,
        config
    };
}


/**
 * Change startup parameters.
 * 
 * @param {object} params - The new parameters.
 * 
 * @memberof Redux Store.Actions
 */
export function setStartupParameters(params) {
    return {
        type: SET_STARTUP_PARAMETERS,
        params
    };
}


/**
 * Change the color scheme.
 * 
 * @param {string} colorScheme - The new color scheme.
 * @param {boolean} storeInLocalStorage - Whether to store the color
 *  scheme in local storage.
 * 
 * @memberof Redux Store.Actions
 */
export function setColorScheme(colorScheme, storeInLocalStorage = false) {
    return {
        type: SET_COLOR_SCHEME,
        colorScheme,
        storeInLocalStorage
    };
}

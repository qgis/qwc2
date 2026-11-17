/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import localConfigReducer from '../reducers/localConfig';
import {SearchProviders} from '../utils/SearchProviders';
ReducerIndex.register("localConfig", localConfigReducer);

export const UPDATE_CONFIG = 'UPDATE_CONFIG';
export const LOCAL_CONFIG_LOADED = 'LOCAL_CONFIG_LOADED';
export const SET_STARTUP_PARAMETERS = 'SET_STARTUP_PARAMETERS';
export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';
export const SET_USER_INFO_FIELDS = 'SET_USER_INFO_FIELDS';
export const REGISTER_CUSTOM_PLUGIN = 'REGISTER_CUSTOM_PLUGIN';
export const UNREGISTER_CUSTOM_PLUGIN = 'UNREGISTER_CUSTOM_PLUGIN';
export const REGISTER_SEARCH_PROVIDER = 'REGISTER_SEARCH_PROVIDER';
export const UNREGISTER_SEARCH_PROVIDER = 'UNREGISTER_SEARCH_PROVIDER';

export function localConfigLoaded(config) {
    return {
        type: LOCAL_CONFIG_LOADED,
        config
    };
}

export function updateConfig(key, value) {
    return {
        type: UPDATE_CONFIG,
        key: key,
        value: value
    };
}

export function setStartupParameters(params, state) {
    return {
        type: SET_STARTUP_PARAMETERS,
        params,
        state
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

export function registerCustomPlugin(name, availableIn3D) {
    return {
        type: REGISTER_CUSTOM_PLUGIN,
        name,
        availableIn3D: availableIn3D
    };
}

export function unregisterCustomPlugin(name) {
    return {
        type: UNREGISTER_CUSTOM_PLUGIN,
        name
    };
}

export function registerSearchProvider(name, provider) {
    return (dispatch) => {
        if (!(name in SearchProviders)) {
            SearchProviders[name] = {...provider, isExternal: true};
            dispatch({
                type: REGISTER_SEARCH_PROVIDER,
                name
            });
        } else {
            // eslint-disable-next-line no-console
            console.warn("Refusing to overwrite existing search provider.");
        }
    };
}

export function unregisterSearchProvider(name) {
    return (dispatch) => {
        if (!SearchProviders[name]) {
            // Pass
        } else if (!SearchProviders[name].isExternal) {
            // eslint-disable-next-line no-console
            console.warn("Refusing to overwrite built-in search provider.");
        } else {
            delete SearchProviders[name];
            dispatch({
                type: UNREGISTER_SEARCH_PROVIDER,
                name
            });
        }
        return {};
    };
}

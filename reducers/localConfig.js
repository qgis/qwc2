/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {LOCAL_CONFIG_LOADED, SET_STARTUP_PARAMETERS, SET_COLOR_SCHEME, SET_USER_INFO_FIELDS, SET_PERMALINK_PARAMETERS} from '../actions/localConfig';
import ConfigUtils from '../utils/ConfigUtils';
import {UrlParams} from '../utils/PermaLinkUtils';

const defaultState = {
    ...ConfigUtils.getDefaults(),
    startupParams: {},
    permalinkParams: {},
    colorScheme: 'default'
};

export default function localConfig(state = defaultState, action) {
    switch (action.type) {
    case LOCAL_CONFIG_LOADED: {
        return {...state, ...action.config};
    }
    case SET_STARTUP_PARAMETERS: {
        return {...state, startupParams: action.params};
    }
    case SET_COLOR_SCHEME: {
        const root = document.querySelector(':root');
        if (state.colorScheme) {
            root.classList.remove(state.colorScheme);
        }
        const newColorScheme = action.colorScheme || state.defaultColorScheme || "default";
        if (newColorScheme) {
            root.classList.add(newColorScheme);
        }
        if (UrlParams.getParam("style")) {
            UrlParams.updateParams({style: newColorScheme});
        }
        if (action.storeInLocalStorage) {
            localStorage.setItem('qwc2-color-scheme', newColorScheme);
        }
        return {...state, colorScheme: newColorScheme};
    }
    case SET_USER_INFO_FIELDS: {
        return {
            ...state,
            user_infos: {
                ...state.user_infos,
                ...action.fields
            }
        };
    }
    case SET_PERMALINK_PARAMETERS: {
        return {
            ...state,
            permalinkParams: Object.entries({...state.permalinkParams, ...action.params}).reduce((res, [key, value]) => {
                if (value !== undefined) {
                    res[key] = value;
                }
                return res;
            }, {})
        };
    }
    default:
        return state;
    }
}

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assign from 'object-assign';
import {
    THEMES_LOADED,
    SET_THEME_LAYERS_LIST,
    SET_CURRENT_THEME,
    SWITCHING_THEME
} from '../actions/theme';
import {UrlParams} from '../utils/PermaLinkUtils';

const defaultState = {};

export default function theme(state = defaultState, action) {
    switch (action.type) {
    case SWITCHING_THEME: {
        return assign({}, state, {switching: action.switching});
    }
    case THEMES_LOADED: {
        return assign({}, state, {themes: action.themes});
    }
    case SET_THEME_LAYERS_LIST: {
        return assign({}, state, {themelist: action.themelist});
    }
    case SET_CURRENT_THEME: {
        UrlParams.updateParams({t: action.theme.id});
        return assign({}, state, {current: action.theme});
    }
    default:
        return state;
    }
}

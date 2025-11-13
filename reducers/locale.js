/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import deepmerge from 'deepmerge';
import {flatten} from 'flat';

import {CHANGE_LOCALE, ADD_TRANSLATIONS} from '../actions/locale';

const defaultState = {
    messages: {},
    fallbackMessages: {},
    current: null
};

export default function locale(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_LOCALE: {
        return {
            messagesTree: action.messages,
            messages: flatten(action.messages),
            fallbackMessages: flatten(action.fallbackMessages),
            current: action.locale
        };
    }
    case ADD_TRANSLATIONS: {
        return {
            ...state,
            messagesTree: deepmerge(state.messages, action.translations[state.current]),
            messages: {...state.messages, ...flatten(action.translations[state.current] || {})}
        };
    }
    default:
        return state;
    }
}

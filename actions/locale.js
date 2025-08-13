/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import localeReducer from '../reducers/locale';
ReducerIndex.register("locale", localeReducer);

export const CHANGE_LOCALE = 'CHANGE_LOCALE';
export const ADD_TRANSLATIONS = 'ADD_TRANSLATIONS';

export function changeLocale(localeData, fallbackLocaleData) {
    return {
        type: CHANGE_LOCALE,
        locale: localeData.locale,
        messages: localeData.messages,
        fallbackMessages: fallbackLocaleData.messages
    };
}

export function addTranslations(translations) {
    return {
        type: ADD_TRANSLATIONS,
        translations
    };
}

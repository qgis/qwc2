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

import axios from 'axios';
import deepmerge from 'deepmerge';

import ConfigUtils from '../utils/ConfigUtils';
import {UrlParams} from '../utils/PermaLinkUtils';

export const CHANGE_LOCALE = 'CHANGE_LOCALE';
export const ADD_TRANSLATIONS = 'ADD_TRANSLATIONS';

export function loadLocale(defaultLangData, defaultLang = "") {
    return dispatch => {
        const lang = defaultLang || UrlParams.getParam("lang") || navigator.language;
        let loadLang = null;
        const availableLanguages = process.env.AvailableLanguages;
        if (availableLanguages.indexOf(lang) !== -1) {
            // Exact match: lang-REGION
            loadLang = lang;
        } else if (availableLanguages.indexOf(lang.slice(0, 2)) !== -1) {
            // Exact match: lang
            loadLang = lang.slice(0, 2);
        } else {
            // Try match lang-<OTHER_REGION>
            loadLang = availableLanguages.find(lc => lc.slice(0, 2) === lang.slice(0, 2));
        }
        const config = {
            headers: {'Content-Type': 'application/json'},
            data: {}
        };
        const translationsPath = ConfigUtils.getTranslationsPath();
        const dispatchChangeLocale = (locale, messages) => {
            if (ConfigUtils.getConfigProp("loadTranslationOverrides")) {
                axios.get(translationsPath + '/' + locale + '_overrides.json', config).then(response => {
                    const overrideMessages = response.data.messages;
                    dispatch({
                        type: CHANGE_LOCALE,
                        locale: locale,
                        messages: deepmerge(messages, overrideMessages),
                        fallbackMessages: defaultLangData.messages
                    });
                }).catch(() => {
                    dispatch({
                        type: CHANGE_LOCALE,
                        locale: locale,
                        messages: messages,
                        fallbackMessages: defaultLangData.messages
                    });
                });
            } else {
                dispatch({
                    type: CHANGE_LOCALE,
                    locale: locale,
                    messages: messages,
                    fallbackMessages: defaultLangData.messages
                });
            }
        };
        if (!loadLang) {
            // eslint-disable-next-line
            console.warn("No suitable translations available for " + lang + ", defaulting to " + defaultLangData.locale);
            dispatchChangeLocale(defaultLangData.locale, defaultLangData.messages);
        } else {
            axios.get(translationsPath + '/' + loadLang + '.json', config).then(response => {
                dispatchChangeLocale(loadLang, response.data.messages);
            }).catch(() => {
                // eslint-disable-next-line
                console.warn("Failed to load translations for " + loadLang + ", defaulting to " + defaultLangData.locale);
                dispatchChangeLocale(defaultLangData.locale, defaultLangData.messages);
            });
        }
    };
}

export function addTranslations(translations) {
    return {
        type: ADD_TRANSLATIONS,
        translations
    };
}

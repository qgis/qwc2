/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import localeReducer from '../reducers/locale';
ReducerIndex.register("locale", localeReducer);

import axios from 'axios';
import {getLanguageCountries} from 'country-language';
import ConfigUtils from '../utils/ConfigUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import deepmerge from 'deepmerge';

export const CHANGE_LOCALE = 'CHANGE_LOCALE';

export function loadLocale(defaultLangData, defaultLang = "") {
    return dispatch => {
        let lang = defaultLang || UrlParams.getParam("lang") || (navigator ? (navigator.language || navigator.browserLanguage) : "en-US");
        const config = {
            headers: {'Content-Type': 'application/json'},
            data: {}
        };
        const translationsPath = ConfigUtils.getTranslationsPath();
        axios.get(translationsPath + '/' + lang + '.json', config).then(response => {
            const messages = response.data.messages;
            if (ConfigUtils.getConfigProp("loadTranslationOverrides")) {
                axios.get(translationsPath + '/' + lang + '-overrides.json', config).then(response2 => {
                    const overrideMessages = response2.data.messages;
                    dispatch({
                        type: CHANGE_LOCALE,
                        locale: lang,
                        messages: deepmerge(messages, overrideMessages)
                    });
                }).catch(() => {
                    dispatch({
                        type: CHANGE_LOCALE,
                        locale: lang,
                        messages: messages
                    });
                });
            } else {
                dispatch({
                    type: CHANGE_LOCALE,
                    locale: lang,
                    messages: messages
                });
            }
        }).catch((e) => {
            const langCode = lang.slice(0, 2).toLowerCase();
            const countries = getLanguageCountries(langCode);
            const country = countries.find(entry => entry.code_2 === langCode.toUpperCase()) ? langCode.toUpperCase() : ((countries[0] || {}).code_2 || "");
            // eslint-disable-next-line
            console.warn("Failed to load locale for " + lang + " (" + e + "), trying " + langCode + "-" + country);
            lang = langCode + "-" + country;
            axios.get(translationsPath + '/' + lang + '.json', config).then(response => {
                dispatch({
                    type: CHANGE_LOCALE,
                    locale: lang,
                    messages: response.data.messages
                });
            }).catch((e2) => {
                // eslint-disable-next-line
                console.warn("Failed to load locale for " + lang + " (" + e2 + "), defaulting to " + defaultLangData.locale);
                dispatch({
                    type: CHANGE_LOCALE,
                    locale: defaultLangData.locale,
                    messages: defaultLangData.messages
                });
            });
        });
    };
}

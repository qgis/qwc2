/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import deepmerge from 'deepmerge';

import StandardApp from '../components/StandardApp';
import ConfigUtils from './ConfigUtils';


const LocaleUtils = {
    loadLocale(lang, fallbackLangData) {
        return new Promise(resolve => {
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
            const resolveLang = (locale, messages) => {
                if (ConfigUtils.getConfigProp("loadTranslationOverrides")) {
                    axios.get(translationsPath + '/' + locale + '_overrides.json', config).then(response => {
                        const overrideMessages = response.data.messages;
                        resolve({
                            locale: locale,
                            messages: deepmerge(messages, overrideMessages)
                        });
                    }).catch(() => {
                        resolve({
                            locale: locale,
                            messages: messages
                        });
                    });
                } else {
                    resolve({
                        locale: locale,
                        messages: messages
                    });
                }
            };
            if (!loadLang) {
                // eslint-disable-next-line
                console.warn("No suitable translations available for " + lang + ", defaulting to " + fallbackLangData.locale);
                resolveLang(fallbackLangData.locale, fallbackLangData.messages);
            } else {
                axios.get(translationsPath + '/' + loadLang + '.json', config).then(response => {
                    resolveLang(loadLang, response.data.messages);
                }).catch(() => {
                    // eslint-disable-next-line
                    console.warn("Failed to load translations for " + loadLang + ", defaulting to " + fallbackLangData.locale);
                    resolveLang(fallbackLangData.locale, fallbackLangData.messages);
                });
            }
        });
    },
    tr(key) {
        const state = StandardApp.store.getState();
        const text = key in state.locale.messages ? (state.locale.messages[key] || state.locale.fallbackMessages[key] || key) : key;

        const args = Array.prototype.slice.call(arguments, 1);
        if (args.length > 0) {
            return text.replace(/{(\d+)}/g, (match, number) => {
                return typeof args[number] !== 'undefined' ? args[number] : match;
            });
        } else {
            return text;
        }
    },
    // Just a stub to make updateTranslations pick up the msgId
    trmsg(key) {
        return key;
    },
    trWithFallback(key, fallback) {
        const state = StandardApp.store.getState();
        return state.locale.messages[key] || fallback;
    },
    lang() {
        const state = StandardApp.store.getState();
        return state.locale.current;
    },
    toLocaleFixed(number, decimals) {
        if (ConfigUtils.getConfigProp("localeAwareNumbers")) {
            return number.toLocaleString(LocaleUtils.lang(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        } else {
            return number.toFixed(decimals);
        }
    },
    commonTranslations() {
        return StandardApp.store.getState().locale.messagesTree.maptranslations || {};
    }
};

export default LocaleUtils;

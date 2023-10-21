/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import StandardStore from '../stores/StandardStore';
import ConfigUtils from './ConfigUtils';


/**
 * Translation and localization.
 * 
 * The library relies on the `scripts/updateTranslations.js` script to extract
 * translation keys from the source code.
 * 
 * @namespace
 */
const LocaleUtils = {
    /**
     * Return the translation for the given key.
     * 
     * The function expects the string templates for current locale to be
     * present in the Redux store under `state.locale.messages`. If the
     * template is not found, the key itself is returned.
     * 
     * If the template contains placeholders, they are replaced by the
     * corresponding arguments. The placeholders are numbered starting from 0,
     * so the second argument to this function replaces `{0}`,
     * the third `{1}` etc.
     * 
     * @param {string} key - the translation key used to locate the
     *  string template
     * @param {...string} args - the arguments to the string template
     * 
     * @return {string} the translated string
     */
    tr(key, ...args) {
        const state = StandardStore.get().getState();
        const text = key in state.locale.messages
            ? (state.locale.messages[key] ?? key)
            : key;

        if (args.length > 0) {
            return text.replace(/{(\d+)}/g, (match, number) => {
                return typeof args[number] !== 'undefined'
                    ? args[number]
                    : match;
            });
        } else {
            return text;
        }
    },

    /**
     * A stub for marking strings as translation keys.
     * 
     * This function is used by the `scripts/updateTranslations.js` script to
     * extract translation keys from the source code.
     * 
     * @param {string} key - the translation key
     * @return {string} the translation key
     */
    trmsg(key) {
        return key;
    },

    /**
     * Return the translation for the given key, or the fallback if the key is
     * not found.
     * 
     * The function expects the string templates for current locale to be
     * present in the Redux store under `state.locale.messages`. If the
     * template is not found, the fallback is returned.
     * 
     * Placeholders are not supported by this function.
     * 
     * @param {string} key - the translation key used to locate the
     * string template
     * @param {string} fallback - the fallback string to return if the key is
     * not found
     * 
     * @return {string} the translated string
     */
    trWithFallback(key, fallback, ...args) {
        const state = StandardStore.get().getState();
        return state.locale.messages[key] || fallback;
    },

    /**
     * Return the current locale
     * 
     * The function expects the current locale to be present in the Redux store
     * under `state.locale.current`.
     */
    lang() {
        const state = StandardStore.get().getState();
        return state.locale.current;
    },

    toLocaleFixed(number, digits) {
        if (ConfigUtils.getConfigProp("localeAwareNumbers")) {
            return number.toLocaleString(
                LocaleUtils.lang(), {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
        } else {
            return number.toFixed(digits);
        }
    }
};

export default LocaleUtils;

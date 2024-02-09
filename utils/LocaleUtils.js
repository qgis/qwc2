/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import StandardStore from '../stores/StandardStore';
import ConfigUtils from './ConfigUtils';

const LocaleUtils = {
    tr(key) {
        const state = StandardStore.get().getState();
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
        const state = StandardStore.get().getState();
        return state.locale.messages[key] || fallback;
    },
    lang() {
        const state = StandardStore.get().getState();
        return state.locale.current;
    },
    toLocaleFixed(number, digits) {
        if (ConfigUtils.getConfigProp("localeAwareNumbers")) {
            return number.toLocaleString(LocaleUtils.lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
        } else {
            return number.toFixed(digits);
        }
    }
};

export default LocaleUtils;

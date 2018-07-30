/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const url = require('url');
const ConfigUtils = require('./ConfigUtils');

const {addLocaleData} = require('react-intl');

let supportedLocales = {
     "en": {
        code: "en-US",
        description: "English"
     }
};

const LocaleUtils = {
    ensureIntl(callback) {
        require.ensure(['intl', 'intl/locale-data/jsonp/en.js', 'intl/locale-data/jsonp/it.js', 'intl/locale-data/jsonp/fr.js'], (require) => {
            global.Intl = require('intl');
            require('intl/locale-data/jsonp/en.js');
            require('intl/locale-data/jsonp/it.js');
            require('intl/locale-data/jsonp/fr.js');
            if (callback) {
                callback();
            }
        });
    },
    setSupportedLocales: function(locales) {
        supportedLocales = locales;
        let localeData = [];
        Object.keys(locales).map(key => { localeData.push(...locales[key].localeData); });
        addLocaleData(localeData);
    },
    normalizeLocaleCode: function(localeCode) {
        var retval;
        if (localeCode === undefined || localeCode === null) {
            retval = undefined;
        } else {
            let rg = /^[a-z]+/i;
            let match = rg.exec(localeCode);
            if (match && match.length > 0) {
                retval = match[0].toLowerCase();
            } else {
                retval = undefined;
            }
        }
        return retval;
    },
    getUserLocale: function() {
        return LocaleUtils.getLocale(url.parse(window.location.href, true).query);
    },
    getLocale: function(query) {
        let locale = supportedLocales[
            LocaleUtils.normalizeLocaleCode(query.locale || ConfigUtils.getConfigProp("locale") || (navigator ? navigator.language || navigator.browserLanguage : "en"))
        ];
        return locale ? locale.code : "en-US";
    },
    getSupportedLocales: function() {
        return supportedLocales;
    },
    getMessageById: function(messages, msgId) {
        var message = messages;
        msgId.split('.').forEach(part => {
            message = message ? message[part] : null;
        });
        return message;
    },
    toLocaleFixed(number, digits) {
        if(ConfigUtils.getConfigProp("localeAwareNumbers")) {
            return number.toLocaleString(LocaleUtils.getUserLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
        } else {
            return number.toFixed(digits);
        }
    }
};

module.exports = LocaleUtils;

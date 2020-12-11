/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const axios = require('axios');
const ConfigUtils = require('../utils/ConfigUtils');
const {UrlParams} = require('../utils/PermaLinkUtils');

const CHANGE_LOCALE = 'CHANGE_LOCALE';

function loadLocale(defaultLangData) {
    return dispatch => {
        const lang = UrlParams.getParam("lang") || (navigator ? (navigator.language || navigator.browserLanguage) : "en-US");
        const config = {
            headers: {'Content-Type': 'application/json'},
            data: {}
        };
        const translationsPath = ConfigUtils.getConfigProp("translationsPath");
        axios.get(translationsPath + '/' + lang + '.json', config).then(response => {
            dispatch({
                type: CHANGE_LOCALE,
                locale: lang,
                messages: response.data.messages
            });
        }).catch((e) => {
            console.warn("Failed to load locale for " + lang + " (" + e + "), defaulting to " + defaultLangData.locale);
            dispatch({
                type: CHANGE_LOCALE,
                locale: defaultLangData.locale,
                messages: defaultLangData.messages
            });
        });
    };
}

module.exports = {
    CHANGE_LOCALE,
    loadLocale
};

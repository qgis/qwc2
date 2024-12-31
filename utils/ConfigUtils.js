/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import isMobile from 'ismobilejs';
import url from 'url';

let config = {
    assetsPath: "assets",
    translationsPath: "translations",
    defaultFeatureStyle: {
        strokeColor: [0, 0, 255, 1],
        strokeWidth: 2,
        strokeDash: [4],
        fillColor: [0, 0, 255, 0.33],
        circleRadius: 10,
        textFill: 'black',
        textStroke: 'white'
    }
};

export default {
    getDefaults() {
        return config;
    },
    loadConfiguration(configParams = {}) {
        let configFile = 'config.json';
        const urlQuery = url.parse(window.location.href, true).query;
        if (urlQuery.localConfig) {
            configFile = urlQuery.localConfig + '.json';
        }
        return axios.get(configFile, {params: configParams}).then(response => {
            if (typeof response.data === 'object') {
                config = {...config, ...response.data};
            } else {
                /* eslint-disable-next-line */
                console.warn("Broken configuration file " + configFile + "!");
            }
            // Set isMobile
            config.isMobile = isMobile(window.navigator).any;
            return config;
        });
    },
    isMobile() {
        return config.isMobile;
    },
    getConfigProp(prop, theme, defval = undefined) {
        const section = config.isMobile ? "mobile" : "desktop";
        const themeProp = theme?.config?.[section]?.[prop] ?? theme?.config?.[prop];
        return themeProp ?? config[section]?.[prop] ?? config[prop] ?? defval;
    },
    getAssetsPath() {
        return config.assetsPath.replace(/\/$/g, "");
    },
    getTranslationsPath() {
        return config.translationsPath.replace(/\/$/g, "");
    },
    havePlugin(name) {
        return config.plugins[config.isMobile ? "mobile" : "desktop"].find(entry => entry.name === name);
    },
    getPluginConfig(name) {
        return config.plugins[config.isMobile ? "mobile" : "desktop"].find(entry => entry.name === name) || {};
    }
};

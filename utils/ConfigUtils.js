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

import StandardStore from '../stores/StandardStore';

let defaultConfig = {
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

let mobile = undefined;

const ConfigUtils = {
    getDefaults() {
        return defaultConfig;
    },
    loadConfiguration(configParams = {}) {
        let configFile = 'config.json';
        const urlQuery = url.parse(window.location.href, true).query;
        if (urlQuery.localConfig) {
            configFile = urlQuery.localConfig + '.json';
        }
        return axios.get(configFile, {params: configParams}).then(response => {
            if (typeof response.data === 'object') {
                defaultConfig = {...defaultConfig, ...response.data};
            } else {
                /* eslint-disable-next-line */
                console.warn("Broken configuration file " + configFile + "!");
            }
            return defaultConfig;
        });
    },
    /**
    * Utility to detect browser properties.
    * Code from leaflet-src.js
    */
    getBrowserProperties() {

        const ie = 'ActiveXObject' in window;
        const ielt9 = ie && !document.addEventListener;
        const ie11 = ie && (window.location.hash === !!window.MSInputMethodContext && !!document.documentMode);

        // terrible browser detection to work around Safari / iOS / Android browser bugs
        const ua = navigator.userAgent.toLowerCase();
        const webkit = ua.indexOf('webkit') !== -1;
        const chrome = ua.indexOf('chrome') !== -1;
        const phantomjs = ua.indexOf('phantom') !== -1;
        const android = ua.indexOf('android') !== -1;
        const android23 = ua.search('android [23]') !== -1;
        const gecko = ua.indexOf('gecko') !== -1;

        mobile = isMobile(window.navigator).any;
        const msPointer = !window.PointerEvent && window.MSPointerEvent;
        const pointer = (window.PointerEvent && window.navigator.pointerEnabled && window.navigator.maxTouchPoints) || msPointer;
        const retina = ('devicePixelRatio' in window && window.devicePixelRatio > 1) ||
                 ('matchMedia' in window && window.matchMedia('(min-resolution:144dpi)') &&
                  window.matchMedia('(min-resolution:144dpi)').matches);

        const doc = document.documentElement;
        const ie3d = ie && ('transition' in doc.style);
        const webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23;
        const gecko3d = 'MozPerspective' in doc.style;
        const opera3d = 'OTransition' in doc.style;
        const any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d || opera3d) && !phantomjs;

        const touch = !window.L_NO_TOUCH && !phantomjs && (pointer || 'ontouchstart' in window ||
            (window.DocumentTouch && document instanceof window.DocumentTouch));

        return {
            ie: ie,
            ie11: ie11,
            ielt9: ielt9,
            webkit: webkit,
            gecko: gecko && !webkit && !window.opera && !ie,

            android: android,
            android23: android23,

            chrome: chrome,

            ie3d: ie3d,
            webkit3d: webkit3d,
            gecko3d: gecko3d,
            opera3d: opera3d,
            any3d: any3d,

            mobile: mobile,
            mobileWebkit: mobile && webkit,
            mobileWebkit3d: mobile && webkit3d,
            mobileOpera: mobile && window.opera,

            touch: touch,
            msPointer: msPointer,
            pointer: pointer,

            retina: retina,

            platform: navigator.platform
        };
    },
    getConfigProp(prop, theme, defval = undefined) {
        const section = mobile ? "mobile" : "desktop";
        const themeProp = theme?.config?.[section]?.[prop] ?? theme?.config?.[prop];
        return themeProp ?? defaultConfig[section]?.[prop] ?? defaultConfig[prop] ?? defval;
    },
    getAssetsPath() {
        return (ConfigUtils.getConfigProp("assetsPath") || "assets").replace(/\/$/g, "");
    },
    getTranslationsPath() {
        return (ConfigUtils.getConfigProp("translationsPath") || "translations").replace(/\/$/g, "");
    },
    havePlugin(name) {
        const state = StandardStore.get().getState();
        return defaultConfig.plugins[state.browser.mobile ? "mobile" : "desktop"].find(entry => entry.name === name);
    },
    getPluginConfig(name) {
        const state = StandardStore.get().getState();
        return defaultConfig.plugins[state.browser.mobile ? "mobile" : "desktop"].find(entry => entry.name === name) || {};
    }
};

export default ConfigUtils;

/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var axios = require('axios');
const assign = require('object-assign');
const url = require('url');
const isMobile = require('ismobilejs');

let defaultConfig = {
    proxyServiceUrl: "",
    translationsPath: "translations",
    bingApiKey: null,
    mapquestApiKey: null,
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

var ConfigUtils = {
    getDefaults: function() {
        return defaultConfig;
    },
    loadConfiguration: function() {
        let configFile = 'config.json';
        const urlQuery = url.parse(window.location.href, true).query;
        if (urlQuery.localConfig) {
            configFile = urlQuery.localConfig + '.json';
        }
        return axios.get(configFile).then(response => {
            if (typeof response.data === 'object') {
                defaultConfig = assign({}, defaultConfig, response.data);
            } else {
                console.warn("Broken configuration file " + configFile + "!")
            }
            return defaultConfig;
        });
    },
    getProxyUrl: function(config = {}) {
        return config.proxyServiceUrl ? config.proxyServiceUrl : defaultConfig.proxyServiceUrl;
    },
    /**
    * Utility to detect browser properties.
    * Code from leaflet-src.js
    */
    getBrowserProperties: function() {

        let ie = 'ActiveXObject' in window;
        let ielt9 = ie && !document.addEventListener;
        let ie11 = ie && (window.location.hash === !!window.MSInputMethodContext && !!document.documentMode);

        // terrible browser detection to work around Safari / iOS / Android browser bugs
        let ua = navigator.userAgent.toLowerCase();
        let webkit = ua.indexOf('webkit') !== -1;
        let chrome = ua.indexOf('chrome') !== -1;
        let phantomjs = ua.indexOf('phantom') !== -1;
        let android = ua.indexOf('android') !== -1;
        let android23 = ua.search('android [23]') !== -1;
        let gecko = ua.indexOf('gecko') !== -1;

        let mobile = isMobile.any; // typeof window.orientation !== undefined + '';
        let msPointer = !window.PointerEvent && window.MSPointerEvent;
        let pointer = (window.PointerEvent && window.navigator.pointerEnabled && window.navigator.maxTouchPoints) ||
                  msPointer;
        let retina = ('devicePixelRatio' in window && window.devicePixelRatio > 1) ||
                 ('matchMedia' in window && window.matchMedia('(min-resolution:144dpi)') &&
                  window.matchMedia('(min-resolution:144dpi)').matches);

        let doc = document.documentElement;
        let ie3d = ie && ('transition' in doc.style);
        let webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23;
        let gecko3d = 'MozPerspective' in doc.style;
        let opera3d = 'OTransition' in doc.style;
        let any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d || opera3d) && !phantomjs;

        let touch = !window.L_NO_TOUCH && !phantomjs && (pointer || 'ontouchstart' in window ||
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

        retina: retina
        };
    },
    getConfigProp: function(prop) {
        return defaultConfig[prop];
    }
};

module.exports = ConfigUtils;

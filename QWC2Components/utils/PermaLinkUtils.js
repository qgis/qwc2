/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const url = require('url');
const axios = require('axios');
const assign = require('object-assign');
const objectPath = require('object-path');
const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');

const UrlParams = {
   updateParams: function(dict) {
       var urlObj = url.parse(window.location.href, true);
       urlObj.query = assign(urlObj.query, dict);
       var propNames = Object.getOwnPropertyNames(urlObj.query);

       for (let propName of propNames) {
           if(urlObj.query[propName] === undefined) {
               delete urlObj.query[propName];
           }
       }
       delete urlObj.search;
       history.pushState({id: urlObj.host}, '', url.format(urlObj));
   },
   getParam: function(key) {
       var urlObj = url.parse(window.location.href, true);
       return urlObj.query[key];
   },
   getParams: function() {
       return url.parse(window.location.href, true).query;
   }
};

function generatePermaLink(callback) {
    axios.get(ConfigUtils.getConfigProp("qwc2serverUrl").replace(/\/$/, '') + "/createpermalink?url=" + encodeURIComponent(window.location.href))
        .then(response => callback(response.data.permalink))
        .catch(e => callback(window.location.href));
}

function resolvePermaLink(initialParams, callback) {
    let key = UrlParams.getParam('k');
    if(key) {
        axios.get(ConfigUtils.getConfigProp("qwc2serverUrl").replace(/\/$/, '') + "/resolvepermalink?key=" + key)
            .then(response => {
                callback(response.data.query || {});
            })
            .catch(e => callback(initialParams));
    } else {
        callback(initialParams);
    }
}

module.exports = {
    UrlParams,
    generatePermaLink,
    resolvePermaLink
};

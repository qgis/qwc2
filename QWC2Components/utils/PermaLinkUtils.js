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
const {LayerRole} = require('../actions/layers');
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

function generatePermaLink(state, callback) {
    // Subset of the state to send to permalink server
    let permalinkState = {
        layers: (state.layers && state.layers.flat || []).filter(layer => layer.role === LayerRole.USERLAYER)
    };
    axios.post(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/createpermalink?url=" + encodeURIComponent(window.location.href), permalinkState)
        .then(response => callback(response.data.permalink))
        .catch(e => callback(window.location.href));
}

function resolvePermaLink(initialParams, callback) {
    let key = UrlParams.getParam('k');
    if(key) {
        axios.get(ConfigUtils.getConfigProp("permalinkServiceUrl").replace(/\/$/, '') + "/resolvepermalink?key=" + key)
            .then(response => {
                callback(response.data.query || {}, response.data.state || {});
            })
            .catch(e => {
                callback(initialParams, {});
            });
    } else {
        callback(initialParams, {});
    }
}

module.exports = {
    UrlParams,
    generatePermaLink,
    resolvePermaLink
};

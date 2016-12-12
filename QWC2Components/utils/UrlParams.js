/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const url = require('url');
const assign = require('object-assign');

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

module.exports = UrlParams;

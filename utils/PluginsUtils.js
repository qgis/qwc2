/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const omit = require('lodash.omit');
const {combineReducers} = require('redux');


const PluginsUtils = {
    getPluginReducers: (plugins) => {
        return Object.keys(plugins).map((name) => plugins[name].reducers)
                                    .reduce((previous, current) => assign({}, previous, current), {});
    },
    getPlugins: (plugins) => Object.keys(plugins).map((name) => plugins[name])
                                .reduce((previous, current) => assign({}, previous, omit(current, 'reducers')), {}),
};
module.exports = PluginsUtils;

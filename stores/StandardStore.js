/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const assign = require('object-assign');
const {combineReducers} = require('redux');
const merge = require('deepmerge');

const DebugUtils = require('../utils/DebugUtils');
const PluginsUtils = require('../utils/PluginsUtils');

const {CHANGE_BROWSER_PROPERTIES} = require('../actions/browser');

module.exports = (initialState = {defaultState: {}, mobile: {}}, plugins, storeOpts, actionLogger) => {
    const allReducers = combineReducers({
        localConfig: require('../reducers/localConfig'),
        locale: require('../reducers/locale'),
        browser: require('../reducers/browser'),
        identify: require('../reducers/identify'),
        map: require('../reducers/map'),
        layers: require('../reducers/layers'),
        ...PluginsUtils.getPluginReducers(plugins)
    });

    const defaultState =  merge({
        ...allReducers({}, {type: null}),
    }, initialState.defaultState);
    const mobileOverride = initialState.mobile;

    const rootReducer = (state, action) => {
        let newState = {
            ...allReducers(state, action),
        };
        if(actionLogger) {
            actionLogger(action, newState);
        }
        if (action && action.type === CHANGE_BROWSER_PROPERTIES && newState.browser.mobile) {
            newState = merge(newState, mobileOverride);
        }

        return newState;
    };
    return DebugUtils.createDebugStore(rootReducer, defaultState);
};

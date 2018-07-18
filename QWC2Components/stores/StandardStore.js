/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const assign = require('object-assign');
const {combineReducers} = require('redux');
const merge = require('deepmerge').default;

const map = require('../reducers/map');

const DebugUtils = require('../../MapStore2Components/utils/DebugUtils');
const PluginsUtils = require('../../MapStore2Components/utils/PluginsUtils');

const {CHANGE_BROWSER_PROPERTIES} = require('../../MapStore2Components/actions/browser');
const {persistStore, autoRehydrate} = require('redux-persist');

const SecurityUtils = require('../../MapStore2Components/utils/SecurityUtils');

module.exports = (initialState = {defaultState: {}, mobile: {}}, plugins, storeOpts, actionLogger) => {
    const allReducers = combineReducers({
        localConfig: require('../../MapStore2Components/reducers/localConfig'),
        locale: require('../../MapStore2Components/reducers/locale'),
        browser: require('../../MapStore2Components/reducers/browser'),
        map: () => {return null; },
        layers: () => {return null; },
        ...PluginsUtils.getPluginReducers(plugins)
    });

    const defaultState =  merge({
        ...allReducers({}, {type: null}),
    }, initialState.defaultState);
    const mobileOverride = initialState.mobile;

    const rootReducer = (state, action) => {
        if(actionLogger) {
            actionLogger(action);
        }
        let newState = {
            ...allReducers(state, action),
        };
        if (action && action.type === CHANGE_BROWSER_PROPERTIES && newState.browser.mobile) {
            newState = merge(newState, mobileOverride);
        }

        return newState;
    };
    let store;
    if (storeOpts && storeOpts.persist) {
        store = DebugUtils.createDebugStore(rootReducer, defaultState, [], autoRehydrate());
        persistStore(store, storeOpts.persist, storeOpts.onPersist);
    } else {
        store = DebugUtils.createDebugStore(rootReducer, defaultState);
    }
    SecurityUtils.setStore(store);
    return store;
};

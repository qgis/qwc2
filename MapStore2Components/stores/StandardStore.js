/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const assign = require('object-assign');
const {combineReducers} = require('redux');

const map = require('../reducers/map');

const mapConfig = require('../reducers/config');

const DebugUtils = require('../utils/DebugUtils');
const PluginsUtils = require('../utils/PluginsUtils');

const {CHANGE_BROWSER_PROPERTIES} = require('../actions/browser');
const {persistStore, autoRehydrate} = require('redux-persist');

const SecurityUtils = require('../utils/SecurityUtils');

module.exports = (initialState = {defaultState: {}, mobile: {}}, appReducers = {}, plugins, storeOpts) => {
    const allReducers = combineReducers({
        ...appReducers,
        localConfig: require('../reducers/localConfig'),
        locale: require('../reducers/locale'),
        browser: require('../reducers/browser'),
        map: () => {return null; },
        layers: () => {return null; },
        ...PluginsUtils.getPluginReducers(plugins)
    });
    const defaultState = initialState.defaultState;
    const mobileOverride = initialState.mobile;

    const rootReducer = (state, action) => {
        let mapState = mapConfig(state, action);
        let newState = {
            ...allReducers(state, action),
            map: mapState && mapState.map ? map(mapState.map, action) : null
        };
        if (action && action.type === CHANGE_BROWSER_PROPERTIES && newState.browser.mobile) {
            newState = assign(newState, mobileOverride);
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

/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const url = require('url');
const {createStore, compose, applyMiddleware} = require('redux');
const thunkMiddleware = require('redux-thunk').default;
const logger = require('redux-logger').default;
const immutable = require('redux-immutable-state-invariant').default;
const {persistState} = require('redux-devtools');
const DevTools = require('../components/development/DevTools');


const urlQuery = url.parse(window.location.href, true).query;

var DebugUtils = {
    createDebugStore: function(reducer, initialState, userMiddlewares, enhancer) {
        let finalCreateStore;
        if (__DEVTOOLS__ && urlQuery.debug) {
            let middlewares = (userMiddlewares || []).concat([immutable(), thunkMiddleware, logger]);
            finalCreateStore = compose(
                applyMiddleware.apply(null, middlewares),
                window.devToolsExtension ? window.devToolsExtension() : DevTools.instrument(),
                persistState(window.location.href.match(/[?&]debug_session=([^&]+)\b/))
            )(createStore);
        } else {
            let middlewares = (userMiddlewares || []).concat([thunkMiddleware]);
            finalCreateStore = applyMiddleware.apply(null, middlewares)(createStore);
        }
        return finalCreateStore(reducer, initialState, enhancer);
    }
};

module.exports = DebugUtils;

/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {applyMiddleware, combineReducers, compose, createStore} from 'redux';
import {createDevTools} from '@redux-devtools/core';
import {LogMonitor} from '@redux-devtools/log-monitor';
import {DockMonitor} from '@redux-devtools/dock-monitor';
import immutable from 'redux-immutable-state-invariant';
import logger from 'redux-logger';
import thunkMiddleware from  'redux-thunk';
import merge from 'deepmerge';
import url from 'url';
import {CHANGE_BROWSER_PROPERTIES} from '../actions/browser';
import ReducerIndex from '../reducers/index';

/**
 * The library uses a global store.
 * @namespace Redux Store
 */

const DevTools = createDevTools(
    <DockMonitor changePositionKey="ctrl-q" toggleVisibilityKey="ctrl-h">
        <LogMonitor theme="tomorrow" />
    </DockMonitor>
);


/**
 * The global store interface.
 * 
 * @memberof Redux Store
 */
class StandardStore {
    static store = null;

    /**
     * Initializes the global store.
     * 
     * @param {object} initialState - the initial state of the store
     * @param {function} actionLogger - a function to log actions
     */
    static init = (initialState, actionLogger) => {
        const allReducers = combineReducers(ReducerIndex.reducers);

        const defaultState =  merge({
            ...allReducers({}, {type: null})
        }, initialState.defaultState);
        const mobileOverride = initialState.mobile;

        const rootReducer = (state, action) => {
            let newState = {
                ...allReducers(state, action)
            };
            if (actionLogger) {
                actionLogger(action, newState, state);
            }
            if (action && action.type === CHANGE_BROWSER_PROPERTIES && newState.browser.mobile) {
                newState = merge(newState, mobileOverride);
            }

            return newState;
        };

        let finalCreateStore;
        const urlQuery = url.parse(window.location.href, true).query;
        if (process.env.NODE_ENV !== "production" && (urlQuery.debug || "").toLowerCase() === "true") {
            const middlewares = [immutable(), thunkMiddleware, logger];
            finalCreateStore = compose(
                applyMiddleware.apply(null, middlewares),
                window.devToolsExtension ? window.devToolsExtension() : DevTools.instrument()
            )(createStore);
        } else {
            finalCreateStore = applyMiddleware.apply(null, [thunkMiddleware])(createStore);
        }
        StandardStore.store = finalCreateStore(rootReducer, defaultState);
    }

    /**
     * Retrieve the global store.
     * 
     * @return {object} the global store
     */
    static get = () => {
        return StandardStore.store;
    }
}

export default StandardStore;

/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {configureStore} from '@reduxjs/toolkit';
import merge from 'deepmerge';
import {combineReducers} from 'redux';
import {logger} from 'redux-logger';

import {CHANGE_BROWSER_PROPERTIES} from '../actions/browser';
import ReducerIndex from '../reducers/index';


export default class StandardStore {
    static store = null;
    static init = (initialState, actionLogger) => {
        const allReducers = combineReducers(ReducerIndex.reducers);

        const defaultState =  merge({
            ...allReducers({}, {type: null})
        }, initialState.defaultState);
        const mobileOverride = initialState.mobile;

        const searchParams = new URLSearchParams(window.location.search);
        const enableDevTools = process.env.NODE_ENV !== "production" && (searchParams.get("debug") || "").toLowerCase() === "true";

        StandardStore.store = configureStore({
            devTools: enableDevTools,
            reducer: (state, action) => {
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
            },
            preloadedState: defaultState,
            middleware: (getDefaultMiddleware) => {
                const middleware = getDefaultMiddleware({
                    serializableCheck: false
                });
                if (enableDevTools) {
                    middleware.push(logger);
                }
                return middleware;
            }
        });
    };
    static get = () => {
        return StandardStore.store;
    };
}

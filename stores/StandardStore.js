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


export const createStore = (reducers, initialState = {}, actionLogger = null) => {
    const allReducers = combineReducers(reducers);

    const defaultState =  merge({
        ...allReducers({}, {type: null})
    }, initialState.defaultState || {});

    const searchParams = new URLSearchParams(window.location.search);
    const enableDevTools = process.env.NODE_ENV !== "production" && (searchParams.get("debug") || "").toLowerCase() === "true";

    return configureStore({
        devTools: enableDevTools,
        reducer: (state, action) => {
            const newState = {
                ...allReducers(state, action)
            };
            if (actionLogger) {
                actionLogger(action, newState, state);
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

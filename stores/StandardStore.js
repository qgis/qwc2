/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {combineReducers} from 'redux';
import merge from 'deepmerge';
import DebugUtils from '../utils/DebugUtils';

export const ReducerRegistry = {
    reducers: {},
    register(name, reducer) {
        ReducerRegistry.reducers[name] = reducer;
    }
};

export default (initialState = {defaultState: {}, mobile: {}}, plugins, storeOpts, actionLogger) => {
    const allReducers = combineReducers(ReducerRegistry.reducers);

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
        if (action && action.type === "CHANGE_BROWSER_PROPERTIES" && newState.browser.mobile) {
            newState = merge(newState, mobileOverride);
        }

        return newState;
    };
    return DebugUtils.createDebugStore(rootReducer, defaultState);
};

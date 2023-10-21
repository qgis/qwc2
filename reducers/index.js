/**
 * Copyright 2021-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


/**
 * The place where we accumulate all reducers.
 * 
 * @memberof Redux Store
 */
const ReducerIndex = {
    /**
     * The reducers.
     */
    reducers: {},

    /**
     * Register a reducer.
     * 
     * @param {string} name - The name of the reducer.
     * @param {function} reducer - The reducer function.
     */
    register(name, reducer) {
        ReducerIndex.reducers[name] = reducer;
    }
};

export default ReducerIndex;

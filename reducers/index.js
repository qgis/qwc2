/**
 * Copyright 2021-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ReducerIndex = {
    reducers: {},
    register(name, reducer) {
        ReducerIndex.reducers[name] = reducer;
    }
};

export default ReducerIndex;

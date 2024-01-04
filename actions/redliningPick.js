/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import redliningPickReducer from '../reducers/redliningPick';
ReducerIndex.register("redliningPick", redliningPickReducer);

export const CHANGE_REDLINING_PICK_STATE = 'CHANGE_REDLINING_PICK_STATE';

export function changeRedliningPickState(data) {
    return {
        type: CHANGE_REDLINING_PICK_STATE,
        data: data
    };
}

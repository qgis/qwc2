/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import redliningPickReducer from '../reducers/redliningPick';
ReducerRegistry.register("redliningPick", redliningPickReducer);

export const CHANGE_REDLINING_PICK_STATE = 'CHANGE_REDLINING_PICK_STATE';

export function changeRedliningPickState(data) {
    return {
        type: CHANGE_REDLINING_PICK_STATE,
        data: data
    };
}

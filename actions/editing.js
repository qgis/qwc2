/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import editingReducer from '../reducers/editing';
ReducerIndex.register("editing", editingReducer);

export const CHANGE_EDITING_STATE = 'CHANGE_EDITING_STATE';

export function changeEditingState(editingState) {
    return {
        type: CHANGE_EDITING_STATE,
        data: editingState
    };
}

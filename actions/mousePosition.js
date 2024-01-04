/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import mousePositionReducer from '../reducers/mousePosition';
ReducerIndex.register("mousePosition", mousePositionReducer);

export const CHANGE_MOUSE_POSITION_STATE = 'CHANGE_MOUSE_POSITION_STATE';

export function changeMousePositionState(data) {
    return {
        type: CHANGE_MOUSE_POSITION_STATE,
        data: data
    };
}

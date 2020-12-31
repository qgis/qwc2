/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import selectionReducer from '../reducers/selection';
ReducerRegistry.register("selection", selectionReducer);

export const CHANGE_SELECTION_STATE = 'CHANGE_SELECTION_STATE';

export function changeSelectionState(selectionState) {
    return {
        type: CHANGE_SELECTION_STATE,
        geomType: selectionState.geomType,
        point: selectionState.point,
        line: selectionState.line,
        polygon: selectionState.polygon,
        style: selectionState.style,
        styleOptions: selectionState.styleOptions,
        cursor: selectionState.cursor,
        reset: selectionState.reset
    };
}

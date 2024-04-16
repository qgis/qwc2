/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import editingReducer from '../reducers/editing';
import ReducerIndex from '../reducers/index';
import {ExpressionFeatureCache, parseExpressionsAsync} from '../utils/EditingUtils';
ReducerIndex.register("editing", editingReducer);

export const SET_EDIT_CONTEXT = 'SET_EDIT_CONTEXT';
export const CLEAR_EDIT_CONTEXT = 'CLEAR_EDIT_CONTEXT';

export function setEditContext(contextId, editContext) {
    return {
        type: SET_EDIT_CONTEXT,
        contextId: contextId,
        editContext: editContext
    };
}

export function clearEditContext(contextId, newActiveContextId = null) {
    return {
        type: CLEAR_EDIT_CONTEXT,
        contextId: contextId,
        newActiveContextId: newActiveContextId
    };
}

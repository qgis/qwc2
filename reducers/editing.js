/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SET_EDIT_CONTEXT, CLEAR_EDIT_CONTEXT} from '../actions/editing';

const defaultState = {
    contexts: {},
    currentContext: null
};

const nonZeroZCoordinate = (coordinates) => {
    return coordinates.find(entry => Array.isArray(entry[0]) ? nonZeroZCoordinate(entry) : entry.length >= 3 && entry[2] !== 0);
};

const checkGeomReadOnly = (oldState, newFeature) => {
    // Only recompute if feature id in state changes
    if (!newFeature) {
        return false;
    } else if (newFeature.id !== ((oldState || {}).feature || {}).id) {
        return nonZeroZCoordinate([newFeature.geometry?.coordinates || []]) !== undefined;
    }
    return (oldState || {}).geomReadOnly || false;
};

export default function editing(state = defaultState, action) {
    switch (action.type) {
    case SET_EDIT_CONTEXT: {
        return {
            contexts: {
                ...state.contexts,
                [action.contextId]: {
                    action: null,
                    feature: null,
                    geomType: null,
                    changed: false,
                    ...state.contexts[action.contextId],
                    ...action.editContext,
                    geomReadOnly: action.editContext.geomReadOnly === true || checkGeomReadOnly(state.contexts[action.contextId], action.editContext.feature),
                    id: action.contextId
                }
            },
            currentContext: action.contextId
        };
    }
    case CLEAR_EDIT_CONTEXT: {
        const newState = {
            contexts: {
                ...state.contexts
            },
            currentContext: state.currentContext === action.contextId ? action.newActiveContextId : state.currentContext
        };
        delete newState.contexts[action.contextId];
        return newState;
    }
    default:
        return state;
    }
}

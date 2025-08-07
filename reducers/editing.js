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

const checkNonZeroZ = (oldState, newState, fallback) => {
    // Only recompute if feature id in state changes
    if (!newState.feature) {
        return false;
    } else if (newState.feature.id !== oldState?.feature?.id) {
        return nonZeroZCoordinate([newState.feature.geometry?.coordinates || []]) !== undefined;
    }
    return oldState?.geomNonZeroZ || false;
};

const checkGeomReadOnly = (geomType) => {
    return (geomType ?? null) !== null && !['Point', 'LineString', 'Polygon'].includes((geomType || "").replace(/^Multi/, '').replace(/Z$/, ''));
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
                    permissions: {},
                    ...state.contexts[action.contextId],
                    ...action.editContext,
                    geomNonZeroZ: checkNonZeroZ(state.contexts[action.contextId], action.editContext),
                    geomReadOnly: checkGeomReadOnly(action.editContext.geomType ?? state.contexts[action.contextId]?.geomType),
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

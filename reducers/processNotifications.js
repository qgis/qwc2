/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    PROCESS_STARTED,
    PROCESS_FINISHED,
    CLEAR_PROCESS,
    ProcessStatus
} from '../actions/processNotifications';

const defaultState = {
    processes: {}
};

export default function processNotifications(state = defaultState, action) {
    switch (action.type) {
    case PROCESS_STARTED: {
        return {
            ...state,
            processes: {
                ...state.processes,
                [action.id]: {
                    id: action.id,
                    name: action.name,
                    status: ProcessStatus.BUSY
                }
            }
        };
    }
    case PROCESS_FINISHED: {
        return {
            ...state,
            processes: {
                ...state.processes,
                [action.id]: {
                    ...state.processes[action.id],
                    status: action.success ? ProcessStatus.SUCCESS : ProcessStatus.FAILURE,
                    message: action.message
                }
            }
        };
    }
    case CLEAR_PROCESS: {
        const newState = {
            ...state,
            processes: {...state.processes}
        };
        delete newState.processes[action.id];
        return newState;
    }
    default:
        return state;
    }
}

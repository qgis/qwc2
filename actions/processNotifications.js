/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import processNotificationsReducer from '../reducers/processNotifications';
ReducerIndex.register("processNotifications", processNotificationsReducer);

export const PROCESS_STARTED = 'PROCESS_STARTED';
export const PROCESS_FINISHED = 'PROCESS_FINISHED';
export const CLEAR_PROCESS = 'CLEAR_PROCESS';

export const ProcessStatus = {
    BUSY: 1,
    SUCCESS: 2,
    FAILURE: 3
};

export function processStarted(id, name) {
    return {
        type: PROCESS_STARTED,
        id,
        name
    };
}

export function processFinished(id, success, message = "") {
    return {
        type: PROCESS_FINISHED,
        id,
        success,
        message
    };
}

export function clearProcess(id) {
    return {
        type: CLEAR_PROCESS,
        id
    };
}

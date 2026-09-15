/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import taskReducer from '../reducers/task';
import ConfigUtils from '../utils/ConfigUtils';
ReducerIndex.register("task", taskReducer);

export const SET_CURRENT_TASK = 'SET_CURRENT_TASK';
export const SET_CURRENT_TASK_BLOCKED = 'SET_CURRENT_TASK_BLOCKED';

export function setCurrentTask(task, mode = null, mapClickAction = null, data = null) {
    return (dispatch, getState) => {
        // Don't do anything if current task is blocked
        if (getState().task && getState().task.blocked === true) {
            return;
        }
        // Attempt to read mapClickAction from plugin configuration block if not set
        if (!mapClickAction) {
            const device = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
            mapClickAction = (getState().localConfig?.plugins?.[device] || []).find(config => config.name === task)?.mapClickAction;
        }
        dispatch({
            type: SET_CURRENT_TASK,
            id: task,
            mode: mode,
            data: data,
            unsetOnMapClick: mapClickAction === 'unset',
            identifyEnabled: task === null || mapClickAction === 'identify'
        });
    };
}

let beforeUnloadListener = null;

export function setCurrentTaskBlocked(blocked, unloadmsg = null) {
    if (beforeUnloadListener) {
        window.removeEventListener('beforeunload', beforeUnloadListener);
        beforeUnloadListener = null;
    }
    if (blocked && unloadmsg !== null) {
        beforeUnloadListener = (event) => {
            event.preventDefault();
            event.returnValue = unloadmsg;
            return unloadmsg;
        };
        window.addEventListener('beforeunload', beforeUnloadListener);
    }
    return {
        type: SET_CURRENT_TASK_BLOCKED,
        blocked
    };
}

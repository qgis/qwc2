/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import taskReducer from '../reducers/task';
ReducerIndex.register("task", taskReducer);

import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import {setIdentifyEnabled} from './identify';
import {showIframeDialog} from './windows';

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
            const device = getState().browser && getState().browser.mobile ? 'mobile' : 'desktop';
            mapClickAction = (getState().localConfig.plugins[device] || []).find(config => config.name === task)?.mapClickAction;
        }
        dispatch(setIdentifyEnabled(task === null || mapClickAction === 'identify'));
        dispatch({
            type: SET_CURRENT_TASK,
            id: task,
            mode: mode,
            data: data,
            unsetOnMapClick: mapClickAction === 'unset'
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

export function openExternalUrl(url, target = '', iframeDialogOpts = {}) {
    return (dispatch, getState) => {
        // Replace all entries in URL
        Object.entries(UrlParams.getParams()).forEach(([key, value]) => {
            url = url.replace('$' + key + '$', value);
        });

        // Additional entries
        const state = getState();
        const bounds = state.map.bbox.bounds;
        const proj = state.map.projection;
        const roundfactor = CoordinatesUtils.getUnits(proj) === 'degrees' ? 100000 : 1;
        const xmin = Math.round(bounds[0] * roundfactor) / roundfactor;
        const ymin = Math.round(bounds[1] * roundfactor) / roundfactor;
        const xmax = Math.round(bounds[2] * roundfactor) / roundfactor;
        const ymax = Math.round(bounds[3] * roundfactor) / roundfactor;
        const x = Math.round(0.5 * (bounds[0] + bounds[2]) * roundfactor) / roundfactor;
        const y = Math.round(0.5 * (bounds[1] + bounds[3]) * roundfactor) / roundfactor;
        const scale = Math.round(MapUtils.computeForZoom(state.map.scales, state.map.zoom));
        // In case mode is center + scale, extent is missing in UrlParams
        url = url.replace('$e$', [xmin, ymin, xmax, ymax].join(","));
        // In case mode is extent, center + scale are missing in UrlParams
        url = url.replace('$c$', x + "," + y);
        url = url.replace('$s$', scale);
        // Add separate x, y
        url = url.replace('$x$', x);
        url = url.replace('$y$', y);

        url = url.replace('$crs$', proj);

        url = url.replace('$user$', ConfigUtils.getConfigProp("username") || "");

        if (target.startsWith(":iframedialog")) {
            const targetParts = target.split(":");
            const options = targetParts.slice(2).reduce((res, cur) => {
                const parts = cur.split("=");
                if (parts.length === 2) {
                    const value = parseFloat(parts[1]);
                    res[parts[0]] = isNaN(value) ? parts[1] : value;
                }
                return res;
            }, {});
            dispatch(showIframeDialog(targetParts[2], url, {...iframeDialogOpts, ...options}));
        } else {
            window.open(url, target || "_blank");
        }
    };
}

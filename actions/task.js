/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SET_CURRENT_TASK = 'SET_CURRENT_TASK';
const SET_CURRENT_TASK_BLOCKED = 'SET_CURRENT_TASK_BLOCKED';
const {setIdentifyEnabled} = require('./identify');
const ConfigUtils = require('../utils/ConfigUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const MapUtils = require('../utils/MapUtils');
const {UrlParams} = require('../utils/PermaLinkUtils');

function setCurrentTask(task, mode=null, allowIdentify=false) {
    return (dispatch, getState) => {
        // Don't do anything if current task is blocked
        if(getState().task && getState().task.blocked === true) {
            return;
        }
        dispatch(setIdentifyEnabled(task === null || task === 'LayerTree' || allowIdentify));
        dispatch({
            type: SET_CURRENT_TASK,
            id: task,
            mode: mode
        });
    }
}

function setCurrentTaskBlocked(blocked) {
    return {
        type: SET_CURRENT_TASK_BLOCKED,
        blocked
    }
}

function openExternalUrl(url) {
    return (dispatch, getState) => {
        // Replace all entries in URL
        Object.entries(UrlParams.getParams()).forEach(([key, value]) => {
            url = url.replace('$' + key + '$', value);
        })

        // Additional entries
        let state = getState();
        let bounds = state.map.bbox.bounds;
        let proj = state.map.projection;
        let roundfactor = CoordinatesUtils.getUnits(proj) === 'degrees' ? 100000. : 1;
        let xmin = Math.round(bounds[0] * roundfactor) / roundfactor;
        let ymin = Math.round(bounds[1] * roundfactor) / roundfactor;
        let xmax = Math.round(bounds[2] * roundfactor) / roundfactor;
        let ymax = Math.round(bounds[3] * roundfactor) / roundfactor;
        let x = Math.round(0.5 * (bounds[0] + bounds[2]) * roundfactor) / roundfactor;
        let y = Math.round(0.5 * (bounds[1] + bounds[3]) * roundfactor) / roundfactor;
        let scale = Math.round(MapUtils.computeForZoom(state.map.scales, state.map.zoom));
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

        window.open(url);
    }
}

module.exports = {
    SET_CURRENT_TASK,
    SET_CURRENT_TASK_BLOCKED,
    setCurrentTask,
    setCurrentTaskBlocked,
    openExternalUrl
}

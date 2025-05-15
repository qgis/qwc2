/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import windowsReducer from '../reducers/windows';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';

ReducerIndex.register("windows", windowsReducer);

export const SHOW_IFRAME_DIALOG = 'SHOW_IFRAME_DIALOG';
export const SHOW_NOTIFICATION = 'SHOW_NOTIFICATION';
export const CLOSE_WINDOW = 'CLOSE_WINDOW';
export const CLOSE_ALL_WINDOWS = 'CLOSE_ALL_WINDOWS';
export const REGISTER_WINDOW = 'REGISTER_WINDOW';
export const UNREGISTER_WINDOW = 'UNREGISTER_WINDOW';
export const RAISE_WINDOW = 'RAISE_WINDOW';
export const SET_MENU_MARGIN = 'SET_MENU_MARGIN';
export const SET_SPLIT_SCREEN = 'SET_SPLIT_SCREEN';
export const SET_TOPBAR_HEIGHT = 'SET_TOPBAR_HEIGHT';
export const SET_BOTTOMBAR_HEIGHT = 'SET_BOTTOMBAR_HEIGHT';

export const NotificationType = {
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

export function showIframeDialog(name, url, options) {
    return {
        type: SHOW_IFRAME_DIALOG,
        name: name,
        url: url,
        options: options
    };
}

export function showNotification(name, text, type = NotificationType.INFO, sticky = false) {
    return {
        type: SHOW_NOTIFICATION,
        name: name,
        text: text,
        notificationType: type,
        sticky: sticky
    };
}

export function closeWindow(name) {
    return {
        type: CLOSE_WINDOW,
        name: name
    };
}

export function closeAllWindows() {
    return {
        type: CLOSE_ALL_WINDOWS
    };
}

export function registerWindow(id) {
    return {
        type: REGISTER_WINDOW,
        id: id
    };
}

export function unregisterWindow(id) {
    return {
        type: UNREGISTER_WINDOW,
        id: id
    };
}

export function raiseWindow(id) {
    return {
        type: RAISE_WINDOW,
        id: id
    };
}

export function setSplitScreen(windowId, side, size, splitTopAndBottomBar) {
    return {
        type: SET_SPLIT_SCREEN,
        windowId: windowId,
        side: side,
        size: size,
        splitTopAndBottomBar: splitTopAndBottomBar
    };
}

export function setMenuMargin(right, left) {
    return {
        type: SET_MENU_MARGIN,
        right: right,
        left: left
    };
}

export function setTopbarHeight(height) {
    return {
        type: SET_TOPBAR_HEIGHT,
        height
    };
}

export function setBottombarHeight(height) {
    return {
        type: SET_BOTTOMBAR_HEIGHT,
        height
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
        if (state.map.scales) {
            const scale = Math.round(MapUtils.computeForZoom(state.map.scales, state.map.zoom));
            url = url.replace('$s$', scale);
            url = url.replace('$c$', x + "," + y);
        }
        url = url.replace('$e$', [xmin, ymin, xmax, ymax].join(","));
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

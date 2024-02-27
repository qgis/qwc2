/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import windowsReducer from '../reducers/windows';
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

export function setSplitScreen(windowId, side, size) {
    return {
        type: SET_SPLIT_SCREEN,
        windowId: windowId,
        side: side,
        size: size
    };
}

export function setMenuMargin(right, left) {
    return {
        type: SET_MENU_MARGIN,
        right: right,
        left: left
    };
}

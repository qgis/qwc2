/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    SHOW_IFRAME_DIALOG,
    SHOW_NOTIFICATION,
    CLOSE_WINDOW,
    CLOSE_ALL_WINDOWS,
    REGISTER_WINDOW,
    UNREGISTER_WINDOW,
    RAISE_WINDOW,
    SET_SPLIT_SCREEN,
    SET_MENU_MARGIN
} from '../actions/windows';

const defaultState = {
    stacking: [],
    splitScreen: {},
    mapMargins: {
        left: 0, top: 0, right: 0, bottom: 0
    },
    menuMargins: {
        left: 0, right: 0
    },
    entries: {}
};

export default function windows(state = defaultState, action) {
    switch (action.type) {
    case SHOW_IFRAME_DIALOG: {
        return {
            ...state,
            entries: {
                ...state.entries,
                [action.name]: {type: 'iframedialog', url: action.url, options: action.options || {}}
            }
        };
    }
    case SHOW_NOTIFICATION: {
        return {
            ...state,
            entries: {
                ...state.entries,
                [action.name]: {type: 'notification', text: action.text, notificationType: action.notificationType, sticky: action.sticky}
            }
        };
    }
    case CLOSE_WINDOW: {
        const newState = {
            ...state,
            entries: {...state.entries}
        };
        delete newState.entries[action.name];
        return newState;
    }
    case CLOSE_ALL_WINDOWS: {
        return {
            ...state,
            entries: Object.entries(state.entries).reduce((res, [name, entry]) => {
                if (entry.sticky) {
                    res[name] = entry;
                }
                return res;
            }, {})
        };
    }
    case REGISTER_WINDOW: {
        return {
            ...state,
            stacking: [...state.stacking, action.id]
        };
    }
    case UNREGISTER_WINDOW: {
        return {
            ...state,
            stacking: state.stacking.filter(x => x !== action.id)
        };
    }
    case RAISE_WINDOW: {
        return {
            ...state,
            stacking: [...state.stacking.filter(x => x !== action.id), action.id]
        };
    }
    case SET_SPLIT_SCREEN: {
        const newSplitScreen = {...state.splitScreen};
        if (action.side === null) {
            delete newSplitScreen[action.windowId];
        } else {
            newSplitScreen[action.windowId] = {
                side: action.side,
                size: action.size
            };
        }
        const splitWindows = Object.values(newSplitScreen);
        const mapMargins = {
            right: splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0) + action.menuMargins.right,
            bottom: splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0),
            left: splitWindows.filter(entry => entry.side === 'left').reduce((res, e) => Math.max(e.size, res), 0) + action.menuMargins.left,
            top: splitWindows.filter(entry => entry.side === 'top').reduce((res, e) => Math.max(e.size, res), 0)
        };
        return {
            ...state,
            splitScreen: newSplitScreen,
            mapMargins: mapMargins
        };
    }
    case SET_MENU_MARGIN: {
        const menuMargins =  {
            right: action.right,
            left: action.left
        };
        const mapMargins =  {
            right: action.right,
            bottom: 0,
            left: action.left,
            top: 0
        };
        return {...state, menuMargins: menuMargins, mapMargins: mapMargins};
    }
    default:
        return state;
    }
}

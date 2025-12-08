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
    SET_MENU_MARGIN,
    SET_TOPBAR_HEIGHT,
    SET_BOTTOMBAR_HEIGHT
} from '../actions/windows';

const defaultState = {
    stacking: [],
    splitScreen: {},
    mapMargins: {
        left: 0, outerLeft: 0, top: 0, right: 0, outerRight: 0, bottom: 0
    },
    menuMargins: {
        left: 0, right: 0
    },
    topbarHeight: 0,
    bottombarHeight: 0,
    entries: {}
};

function computeMapMargins(splitScreen, menuMargins) {
    const splitWindows = Object.values(splitScreen);
    const innerSplitWindows = splitWindows.filter(entry => entry.splitTopAndBottomBar !== true);
    const outerSplitWindows = splitWindows.filter(entry => entry.splitTopAndBottomBar === true);
    const mapMargins = {
        right: innerSplitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0) + menuMargins.right,
        outerRight: outerSplitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0),
        bottom: splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0),
        left: innerSplitWindows.filter(entry => entry.side === 'left').reduce((res, e) => Math.max(e.size, res), 0) + menuMargins.left,
        outerLeft: outerSplitWindows.filter(entry => entry.side === 'left').reduce((res, e) => Math.max(e.size, res), 0),
        top: splitWindows.filter(entry => entry.side === 'top').reduce((res, e) => Math.max(e.size, res), 0)
    };
    return {
        mapMargins,
        splitTopAndBottomBar: outerSplitWindows.length > 0
    };
}

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
                [action.name]: {
                    type: 'notification',
                    text: action.text,
                    notificationType: action.notificationType,
                    sticky: action.sticky,
                    actions: action.actions
                }
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
                size: action.size,
                splitTopAndBottomBar: action.splitTopAndBottomBar
            };
        }
        return {
            ...state,
            splitScreen: newSplitScreen,
            ...computeMapMargins(newSplitScreen, state.menuMargins)
        };
    }
    case SET_MENU_MARGIN: {
        const menuMargins =  {
            right: action.right,
            left: action.left
        };
        return {
            ...state,
            menuMargins: menuMargins,
            ...computeMapMargins(state.splitScreen, menuMargins)
        };
    }
    case SET_TOPBAR_HEIGHT: {
        document.querySelector(':root').style.setProperty('--topbar-height', action.height + 'px');
        if (action.height <= 0) {
            return state;
        }
        return {...state, topbarHeight: action.height};
    }
    case SET_BOTTOMBAR_HEIGHT: {
        document.querySelector(':root').style.setProperty('--bottombar-height', action.height + 'px');
        if (action.height <= 0) {
            return state;
        }
        return {...state, bottombarHeight: action.height};
    }
    default:
        return state;
    }
}

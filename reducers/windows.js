/**
 * Copyright 2020-2021 Sourcepole AG
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
    SET_SPLIT_SCREEN
} from '../actions/windows';

const defaultState = {
    stacking: [],
    splitScreen: {},
    entries: {}
};

export default function windows(state = defaultState, action) {
    switch (action.type) {
        case SHOW_IFRAME_DIALOG: {
            return {
                ...state,
                entries: {
                    ...state.entries,
                    [action.name]: {
                        type: 'iframedialog',
                        url: action.url,
                        options: action.options || {}
                    }
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
                        sticky: action.sticky
                    }
                }
            };
        }
        case CLOSE_WINDOW: {
            const newState = {
                ...state,
                entries: { ...state.entries }
            };
            delete newState.entries[action.name];
            return newState;
        }
        case CLOSE_ALL_WINDOWS: {
            return {
                ...state,
                entries: Object.entries(state.entries)
                    .reduce((res, [name, entry]) => {
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
                stacking: [
                    ...state.stacking.filter(x => x !== action.id),
                    action.id
                ]
            };
        }
        case SET_SPLIT_SCREEN: {
            if (action.side === null) {
                const newSplitScreen = { ...state.splitScreen };
                delete newSplitScreen[action.windowId];
                return {
                    ...state,
                    splitScreen: newSplitScreen
                };
            } else {
                return {
                    ...state,
                    splitScreen: {
                        ...state.splitScreen,
                        [action.windowId]: {
                            side: action.side,
                            size: action.size
                        }
                    }
                };
            }
        }
        default:
            return state;
    }
}

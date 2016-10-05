/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_MEASUREMENT_STATE} = require('../../MapStore2/web/client/actions/measurement');
const {SET_THEME_SWITCHER_VISIBILITY} = require('./theme');
const TOGGLE_APP_MENU = 'TOGGLE_APP_MENU';
const TOGGLE_APP_SUBMENU = 'TOGGLE_APP_SUBMENU';

function toggleAppMenu(visible) {
    return {
        type: TOGGLE_APP_MENU,
        visible: visible
    };
}

function toggleAppSubmenu(submenus) {
    return {
        type: TOGGLE_APP_SUBMENU,
        submenus: submenus
    }
}

function triggerAppMenuitem(key) {
    if(key === 'measure') {
        return {
            type: CHANGE_MEASUREMENT_STATE,
            lineMeasureEnabled: true
        };
    } else if(key === 'themes') {
        return {
            type: SET_THEME_SWITCHER_VISIBILITY,
            visible: true
        }
    }
    return (dispatch) => {};
}

module.exports = {
    TOGGLE_APP_MENU,
    TOGGLE_APP_SUBMENU,
    toggleAppMenu,
    toggleAppSubmenu,
    triggerAppMenuitem
}

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TOGGLE_APP_MENU, TOGGLE_APP_SUBMENU} = require('../actions/AppMenu');
const assign = require('object-assign');

function toggleAppMenu(state = {visible: false}, action) {
    switch (action.type) {
        case TOGGLE_APP_MENU:
            return assign({}, state, {
                visible: action.visible
            });
        case TOGGLE_APP_SUBMENU:
            return assign({}, state, {
                submenus: action.submenus
            });
        default:
            return state;
    }
}

module.exports = toggleAppMenu;

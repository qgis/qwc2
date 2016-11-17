/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
    SET_CURRENT_THEME,
    SET_THEME_SWITCHER_FILTER} = require('../actions/theme');
const assign = require('object-assign');

function themeSwitcher(state = {switchervisible: false, switcherfilter: "", current: null}, action) {
    switch (action.type) {
        case SET_CURRENT_THEME:
            return assign({}, state, {
                current: action.theme,
                currentlayer: action.layer
            });
        case SET_THEME_SWITCHER_FILTER:
            return assign({}, state, {
                switcherfilter: action.filter
            });
        default:
            return state;
    }
}

module.exports = themeSwitcher;

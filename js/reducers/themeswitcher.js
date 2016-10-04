/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {SET_THEME_FILTER, SET_CURRENT_THEME, SET_THEME_SWITCHER_VISIBILITY} = require('../actions/themeswitcher');
const assign = require('object-assign');

function themeSwitcher(state = {filter: "", theme: ""}, action) {
    switch (action.type) {
        case SET_THEME_FILTER:
            return assign({}, state, {
                filter: action.filter
            });
        case SET_CURRENT_THEME:
            return assign({}, state, {
                theme: action.theme,
                layers: action.layers
            });
        case SET_THEME_SWITCHER_VISIBILITY:
            return assign({}, state, {
                visible: action.visible
            });
        default:
            return state;
    }
}

module.exports = themeSwitcher;

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const {UrlParams} = require("../utils/PermaLinkUtils");
const {THEMES_LOADED, SET_CURRENT_THEME, CLEAR_CURRENT_THEME, SWITCHING_THEME} = require('../actions/theme');

function theme(state = {}, action) {
    switch (action.type) {
        case SWITCHING_THEME:
            return assign({}, state, {
                switching: action.switching
            });
        case THEMES_LOADED:
            return assign({}, state, {
                themes: action.themes
            });
        case CLEAR_CURRENT_THEME:
            UrlParams.updateParams({t: undefined, l: undefined});
            return assign({}, state, {
                current: null
            });
        case SET_CURRENT_THEME:
        UrlParams.updateParams({t: action.theme.id});
            return assign({}, state, {
                current: action.theme
            });
        default:
            return state;
    }
}

module.exports = theme;

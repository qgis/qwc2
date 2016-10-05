/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UrlParams = require("../utils/UrlParams");

const SET_STARTUP_THEME = 'SET_STARTUP_THEME';
const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
const SET_THEME_SWITCHER_FILTER = 'SET_THEME_FILTER';
const SET_THEME_SWITCHER_VISIBILITY = 'SET_THEME_SWITCHER_VISIBILITY';


function setStartupTheme(themeid, activelayers) {
    return {
        type: SET_STARTUP_THEME,
        theme: {id: themeid, activelayers: activelayers}
    }
}

function setCurrentTheme(theme) {
    UrlParams.updateParams({t: theme.id});
    UrlParams.updateParams({l: theme.activelayers.join(",")});
    return {
        type: SET_CURRENT_THEME,
        theme: theme
    };
}

function setThemeSwitcherFilter(filter) {
    return {
        type: SET_THEME_SWITCHER_FILTER,
        filter: filter
    };
}

function setThemeSwitcherVisibility(visible)
{
    return {
        type: SET_THEME_SWITCHER_VISIBILITY,
        visible: visible
    }
}

module.exports = {
    SET_STARTUP_THEME,
    SET_CURRENT_THEME,
    SET_THEME_SWITCHER_FILTER,
    SET_THEME_SWITCHER_VISIBILITY,
    setStartupTheme,
    setCurrentTheme,
    setThemeSwitcherFilter,
    setThemeSwitcherVisibility
}

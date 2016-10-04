/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UrlParams = require("../utils/UrlParams");

 const SET_THEME_FILTER = 'SET_THEME_FILTER';
 const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
 const SET_THEME_SWITCHER_VISIBILITY = 'SET_THEME_SWITCHER_VISIBILITY';

 function setThemeFilter(filter) {
     return {
         type: SET_THEME_FILTER,
         filter: filter
     };
 }

 function setCurrentTheme(theme, layers) {
     UrlParams.updateParams({t: theme});
     UrlParams.updateParams({l: layers ? layers.join(",") : ""});
     return {
         type: SET_CURRENT_THEME,
         theme: theme,
         layers: layers
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
     SET_THEME_FILTER,
     SET_CURRENT_THEME,
     SET_THEME_SWITCHER_VISIBILITY,
     setThemeFilter,
     setCurrentTheme,
     setThemeSwitcherVisibility
 }

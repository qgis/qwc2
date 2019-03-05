/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {createSelector} = require('reselect');

const displayCrsSelector = createSelector([
    state => state.map && state.map.projection || undefined,
    state => state.mousePosition && state.mousePosition.crs || undefined
], (mapcrs, mousecrs) => {
    return mousecrs || mapcrs || "EPSG:4326";
});

module.exports = displayCrsSelector;

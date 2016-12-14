/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const displayCrsSelector = (state) => {
    let mapcrs = state && state.map && state.map.present ? state.map.present.projection : undefined;
    let mousecrs = state && state.mousePosition && state.mousePosition ? state.mousePosition.crs : undefined;
    return mousecrs || mapcrs || "EPSG:4326";
};

module.exports = displayCrsSelector;

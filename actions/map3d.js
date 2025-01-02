/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SET_MAP_CRS = 'SET_MAP_CRS';
export const SET_TOPBAR_HEIGHT = 'SET_TOPBAR_HEIGHT';
export const SET_BOTTOMBAR_HEIGHT = 'SET_BOTTOMBAR_HEIGHT';

export function setMapCrs(crs) {
    return {
        type: SET_MAP_CRS,
        crs
    };
}

export function setTopbarHeight(height) {
    return {
        type: SET_TOPBAR_HEIGHT,
        height
    };
}

export function setBottombarHeight(height) {
    return {
        type: SET_BOTTOMBAR_HEIGHT,
        height
    };
}

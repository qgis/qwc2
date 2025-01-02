/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import {
    SET_MAP_CRS, SET_TOPBAR_HEIGHT, SET_BOTTOMBAR_HEIGHT
} from '../actions/map3d';

const defaultState = {
    projection: "EPSG:3857",
    displayCrs: "EPSG:3857",
    topbarHeight: 0,
    bottombarHeight: 0
};

export default function map(state = defaultState, action) {
    switch (action.type) {
    case SET_MAP_CRS: {
        return {
            ...state,
            projection: action.crs,
            displayCrs: action.crs
        };
    }
    case SET_TOPBAR_HEIGHT: {
        return {...state, topbarHeight: action.height};
    }
    case SET_BOTTOMBAR_HEIGHT: {
        return {...state, bottombarHeight: action.height};
    }
    default:
        return state;
    }
}

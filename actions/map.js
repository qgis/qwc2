/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import mapReducer from '../reducers/map';
ReducerIndex.register("map", mapReducer);

export const CHANGE_MAP_VIEW = 'CHANGE_MAP_VIEW';
export const CONFIGURE_MAP = 'CONFIGURE_MAP';
export const CLICK_ON_MAP = 'CLICK_ON_MAP';
export const CHANGE_ZOOM_LVL = 'CHANGE_ZOOM_LVL';
export const PAN_TO = 'PAN_TO';
export const ZOOM_TO_EXTENT = 'ZOOM_TO_EXTENT';
export const ZOOM_TO_POINT = 'ZOOM_TO_POINT';
export const CHANGE_ROTATION = 'CHANGE_ROTATION';
export const TOGGLE_MAPTIPS = 'TOGGLE_MAPTIPS';
export const SET_TOPBAR_HEIGHT = 'SET_TOPBAR_HEIGHT';
export const SET_BOTTOMBAR_HEIGHT = 'SET_BOTTOMBAR_HEIGHT';
export const SET_SNAPPING_CONFIG = 'SET_SNAPPING_CONFIG';

export function changeMapView(center, zoom, bbox, size, mapStateSource, projection) {
    return {
        type: CHANGE_MAP_VIEW,
        center,
        zoom,
        bbox,
        size,
        mapStateSource,
        projection
    };
}

/**
 * @param crs {string} The map projection
 * @param scales {Array} List of map scales
 * @param view {Object} The map view, as follows:
 *               {center: [x, y], zoom: ..., crs: ...}
 *             or
 *               {bounds: [xmin, ymin, xmax, ymax], crs: ...}
 */
export function configureMap(crs, scales, view) {
    return {
        type: CONFIGURE_MAP,
        crs,
        scales,
        view
    };
}

export function clickOnMap(clickData) {
    return {
        type: CLICK_ON_MAP,
        click: clickData
    };
}

export function changeZoomLevel(zoomLvl, mapStateSource) {
    return {
        type: CHANGE_ZOOM_LVL,
        zoom: zoomLvl,
        mapStateSource: mapStateSource
    };
}

export function panTo(pos, crs) {
    return {
        type: PAN_TO,
        pos,
        crs
    };
}

export function zoomToExtent(extent, crs, zoomOffset = 0) {
    return {
        type: ZOOM_TO_EXTENT,
        extent,
        crs,
        zoomOffset
    };
}

export function zoomToPoint(pos, zoom, crs) {
    return {
        type: ZOOM_TO_POINT,
        pos,
        zoom,
        crs
    };
}

export function changeRotation(rotation) {
    return {
        type: CHANGE_ROTATION,
        rotation
    };
}

export function toggleMapTips(active) {
    return {
        type: TOGGLE_MAPTIPS,
        active: active
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

export function setSnappingConfig(enabled, active) {
    return {
        type: SET_SNAPPING_CONFIG,
        enabled: enabled,
        active: active
    };
}

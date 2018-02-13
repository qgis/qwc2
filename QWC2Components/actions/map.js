/**
 * Copyright 2015, GeoSolutions Sas.
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const CHANGE_MAP_VIEW = 'CHANGE_MAP_VIEW';
const CONFIGURE_MAP = 'CONFIGURE_MAP';
const CLICK_ON_MAP = 'CLICK_ON_MAP';
const CHANGE_ZOOM_LVL = 'CHANGE_ZOOM_LVL';
const PAN_TO = 'PAN_TO';
const ZOOM_TO_EXTENT = 'ZOOM_TO_EXTENT';
const ZOOM_TO_POINT = 'ZOOM_TO_POINT';
const CHANGE_ROTATION = 'CHANGE_ROTATION';
const TOGGLE_MAPTIPS = 'TOGGLE_MAPTIPS';

function changeMapView(center, zoom, bbox, size, mapStateSource, projection) {
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
function configureMap(crs, scales, view) {
    return {
        type: CONFIGURE_MAP,
        crs,
        scales,
        view
    };
}

function clickOnMap(point) {
    return {
        type: CLICK_ON_MAP,
        point: point
    };
}

function changeZoomLevel(zoomLvl, mapStateSource) {
    return {
        type: CHANGE_ZOOM_LVL,
        zoom: zoomLvl,
        mapStateSource: mapStateSource
    };
}

function panTo(pos, crs) {
    return {
        type: PAN_TO,
        pos
    };
}

function zoomToExtent(extent, crs) {
    return {
        type: ZOOM_TO_EXTENT,
        extent,
        crs
    };
}

function zoomToPoint(pos, zoom, crs) {
    return {
        type: ZOOM_TO_POINT,
        pos,
        zoom,
        crs
    }
}

function changeRotation(rotation) {
    return {
        type: CHANGE_ROTATION,
        rotation
    };
}

function toggleMapTips(active) {
    return {
        type: TOGGLE_MAPTIPS,
        active: active
    }
}

module.exports = {
    CHANGE_MAP_VIEW,
    CONFIGURE_MAP,
    CLICK_ON_MAP,
    CHANGE_ZOOM_LVL,
    PAN_TO,
    ZOOM_TO_EXTENT,
    ZOOM_TO_POINT,
    CHANGE_ROTATION,
    TOGGLE_MAPTIPS,
    changeMapView,
    configureMap,
    clickOnMap,
    changeZoomLevel,
    zoomToExtent,
    zoomToPoint,
    panTo,
    changeRotation,
    toggleMapTips
};

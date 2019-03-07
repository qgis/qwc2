/**
 * Copyright 2015-2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ConfigUtils = require('./ConfigUtils');
const CoordinatesUtils = require('./CoordinatesUtils');

const DEFAULT_SCREEN_DPI = 96;
const METERS_PER_UNIT = {
    'm': 1,
    'degrees': 111194.87428468118,
    'ft': 0.3048,
    'us-ft': 1200 / 3937
};
const GET_PIXEL_FROM_COORDINATES_HOOK = 'GET_PIXEL_FROM_COORDINATES_HOOK';
const GET_COORDINATES_FROM_PIXEL_HOOK = 'GET_COORDINATES_FROM_PIXEL_HOOK';

var hooks = {};

function registerHook(name, hook) {
    hooks[name] = hook;
}

function getHook(name) {
    return hooks[name];
}

/**
 * @param dpi {number} dot per inch resolution
 * @return {number} dot per meter resolution
 */
function dpi2dpm(dpi) {
    return dpi * (100 / 2.54);
}

/**
 * @param dpi {number} screen resolution in dots per inch.
 * @param projection {string} map projection.
 * @return {number} dots per map unit.
 */
function dpi2dpu(dpi, projection) {
    const units = CoordinatesUtils.getUnits(projection || "EPSG:3857");
    return METERS_PER_UNIT[units] * dpi2dpm(dpi || DEFAULT_SCREEN_DPI);
}

/**
 * Get a list of scales for each zoom level of the Google Mercator.
 * @param minZoom {number} min zoom level.
 * @param maxZoom {number} max zoom level.
 * @return {array} a list of scale for each zoom level in the given interval.
 */
function getGoogleMercatorScales(minZoom, maxZoom, dpi = DEFAULT_SCREEN_DPI) {
    // Google mercator params
    const RADIUS = 6378137;
    const TILE_WIDTH = 256;
    const ZOOM_FACTOR = 2;

    var retval = [];
    for (let l = minZoom; l <= maxZoom; l++) {
        retval.push(2 * Math.PI * RADIUS / (TILE_WIDTH * Math.pow(ZOOM_FACTOR, l) / dpi2dpm(dpi)));
    }
    return retval;
}

/**
 * @param scales {array} list of scales.
 * @param projection {string} map projection.
 * @param dpi {number} screen resolution in dots per inch.
 * @return {array} a list of resolutions corresponding to the given scales, projection and dpi.
 */
function getResolutionsForScales(scales, projection, dpi) {
    const dpu = dpi2dpu(dpi, projection);
    const resolutions = scales.map((scale) => {
        return scale / dpu;
    });
    return resolutions;
}

/**
 * Calculates the best fitting zoom level for the given extent.
 *
 * @param extent {Array} [minx, miny, maxx, maxy]
 * @param resolutions {Array} The list of available map resolutions
 * @param mapSize {Object} current size of the map.
 * @param minZoom {number} min zoom level.
 * @param maxZoom {number} max zoom level.
 * @param dpi {number} screen resolution in dot per inch.
 * @return {Number} the zoom level fitting th extent
 */
function getZoomForExtent(extent, resolutions, mapSize, minZoom, maxZoom) {
    const wExtent = extent[2] - extent[0];
    const hExtent = extent[3] - extent[1];

    const xResolution = Math.abs(wExtent / mapSize.width);
    const yResolution = Math.abs(hExtent / mapSize.height);
    const extentResolution = Math.max(xResolution, yResolution);

    if(ConfigUtils.getConfigProp("allowFractionalZoom") === true) {
        return this.computeZoom(resolutions, extentResolution);
    } else {
        const {zoom, ...other} = resolutions.reduce((previous, resolution, index) => {
            const diff = Math.abs(resolution - extentResolution);
            return diff > previous.diff ? previous : {diff: diff, zoom: index};
        }, {diff: Number.POSITIVE_INFINITY, zoom: 0});
        return Math.max(0, Math.min(zoom, maxZoom));
    }
}

/**
 * Calculates the extent for the provided center and zoom level
 * @param center {Array} [x, y]
 * @param zoom {number} The zoom level
 * @param resolutions {Array} The list of map resolutions
 * @param mapSize {Object} The current size of the map
 */
function getExtentForCenterAndZoom(center, zoom, resolutions, mapSize) {
    if(ConfigUtils.getConfigProp("allowFractionalZoom") !== true) {
        zoom = Math.round(zoom);
    }
    let width = this.computeForZoom(resolutions, zoom) * mapSize.width;
    let height = this.computeForZoom(resolutions, zoom) * mapSize.height;
    return [
        center[0] - 0.5 * width,
        center[1] - 0.5 * height,
        center[0] + 0.5 * width,
        center[1] + 0.5 * height
    ]
}

/**
 * Transform width and height specified in meters to the units of the specified projection
 *
 * @param projection {string} projection.
 * @param center {Array} Center of extent in EPSG:4326 coordinates.
 * @param width {number} Width in meters.
 * @param height {number} Height in meters.
 */
function transformExtent(projection, center, width, height) {
    let units = CoordinatesUtils.getUnits(projection);
    if(units == 'ft') {
        return {width: width / METERS_PER_UNIT['ft'], height: height / METERS_PER_UNIT['ft']};
    } else if(units == 'us-ft') {
        return {width: width / METERS_PER_UNIT['us-ft'], height: height / METERS_PER_UNIT['us-ft']};
    } else if(units == 'degrees') {
        // https://en.wikipedia.org/wiki/Geographic_coordinate_system#Length_of_a_degree
        let phi = center[1] / 180 * Math.PI;
        let latPerM = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
        let lonPerM = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);
        return {width: width / lonPerM, height: height / latPerM};
    }
    return {width, height};
}

/**
 * Compute the scale or resolution matching a (possibly fractional) zoom level.
 *
 * @param list {Array} List of scales or resolutions.
 * @param zoomLevel (number) Zoom level (integer or fractional).
 * @return Scale of resolution matching zoomLevel
 */
function computeForZoom(list, zoomLevel) {
    if(ConfigUtils.getConfigProp("allowFractionalZoom") !== true) {
        return list[Math.min(list.length - 1, Math.round(zoomLevel))];
    }
    zoomLevel = Math.max(zoomLevel, 0);
    let upper = Math.ceil(zoomLevel);
    let lower = Math.floor(zoomLevel);
    if(upper >= list.length) {
        return list[list.length - 1];
    }
    let frac = zoomLevel - lower;
    return list[lower] * (1 - frac) + list[upper] * frac;
}

/**
 * Compute the (possibly fractional) zoom level matching the specified scale or resolution.
 *
 * @param list {Array} List of scales or resolutions.
 * @param value (number) Scale or resolution.
 * @return Zoom level matching the specified scale or resolution.
 */
function computeZoom(list, value) {
    if(ConfigUtils.getConfigProp("allowFractionalZoom") === true) {
        let index = 0;
        for(let i = 1; i < list.length - 1; ++i) {
            if(value <= list[i]) {
                index = i;
            }
        }
        return index + (value - list[index]) / (list[index + 1] - list[index]);
    } else {
        let closestVal = Math.abs(value - list[0]);
        let closestIdx = 0;
        for(let i = 1; i < list.length; ++i) {
            let currVal = Math.abs(value - list[i]);
            if(currVal < closestVal) {
                closestVal = currVal;
                closestIdx = i;
            }
        }
        return closestIdx;
    }
}

module.exports = {
    GET_PIXEL_FROM_COORDINATES_HOOK,
    GET_COORDINATES_FROM_PIXEL_HOOK,
    DEFAULT_SCREEN_DPI,
    registerHook,
    getHook,
    dpi2dpm,
    getGoogleMercatorScales,
    getResolutionsForScales,
    getZoomForExtent,
    getExtentForCenterAndZoom,
    transformExtent,
    computeForZoom,
    computeZoom
};

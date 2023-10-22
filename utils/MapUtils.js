/**
 * Copyright 2015-2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from './CoordinatesUtils';


const DEFAULT_SCREEN_DPI = 96;

// TODO: any reason ro not using the ol defaults?
// ol/proj/Units.js -> METERS_PER_UNIT
const METERS_PER_UNIT = {
    'm': 1,
    'degrees': 111194.87428468118,
    'ft': 0.3048,
    'us-ft': 1200 / 3937 // 0.3048006096
};

const hooks = {};


/**
 * Utility functions for working with the map.
 * 
 * @namespace
 */
const MapUtils = {

    GET_PIXEL_FROM_COORDINATES_HOOK: 'GET_PIXEL_FROM_COORDINATES_HOOK',
    GET_COORDINATES_FROM_PIXEL_HOOK: 'GET_COORDINATES_FROM_PIXEL_HOOK',
    GET_NATIVE_LAYER: 'GET_NATIVE_LAYER',

    /**
     * Save a hook in internal registry (library-wide)
     * 
     * This mechanism imposes no constraints on the hook function. See
     * the documentation for the specific hook key to understand the
     * expected function signature.
     * 
     * @param {string} name - the unique identifier of the hook
     * @param {function} hook - the hook function
     */
    registerHook(name, hook) {
        hooks[name] = hook;
    },

    /**
     * Retrieve a hook from internal registry (library-wide).
     * 
     * This mechanism imposes no constraints on the hook function. See
     * the documentation for the specific hook key to understand the
     * expected function signature.
     * 
     * @param {string} name - the unique identifier of the hook
     * @return {function} the hook function or undefined if 
     * the identifier was not found
     */
    getHook(name) {
        return hooks[name];
    },

    /**
     * Convert a resolution expreseed in dots per inch to a resolution
     * expressed in dots per meter.
     * 
     * @param {number?} dpi - dot per inch resolution (default is 96).
     * @return {number} dot per meter resolution.
     */
    dpi2dpm(dpi = null) {
        return (dpi || DEFAULT_SCREEN_DPI) * (100 / 2.54);
    },

    /**
     * Convert a resolution expreseed in dots per meter to a resolution
     * expressed in dots per units in a particular projection.
     *
     * The function supports projections with following units:
     * - meters;
     * - degrees (default if the projection does not define units);
     * - feet;
     * - us-feet.
     * 
     * @param {number} dpi - screen resolution in dots per
     *  inch (default is 96).
     * @param {string} projection - the projection used to retrieve
     *  the units.
     *
     * @throws {Error} if the projection units are not supported.
     * @throws {Error} if the projection is not supported.
     * @return {number} dots per map unit.
     */
    dpi2dpu(dpi, projection) {
        const units = CoordinatesUtils.getUnits(projection);
        const mpu = METERS_PER_UNIT[units];
        if (!mpu) {
            throw new Error(
                `Unsupported projection ${projection} units: ${units}`
            );
        }
        return mpu * MapUtils.dpi2dpm(dpi);
    },

    /**
     * Get a list of scales, one for each zoom level
     * of the Google Mercator.
     * 
     * @param {number} minZoom - the first zoom level to compute
     *  the scale for (integer >= 0).
     * @param {number} maxZoom - the last zoom level to compute
     *  the scale for (integer).
     * @param {number} dpi - screen resolution in dots per
     *  inch (96 by default).
     * 
     * @return {number[]} a list of scales, one for each zoom level
     *  in the given interval (the lower the zoom level, the
     *  larger the scale).
     */
    getGoogleMercatorScales(minZoom, maxZoom, dpi = DEFAULT_SCREEN_DPI) {
        // Google mercator params
        const RADIUS = 6378137;
        const TILE_WIDTH = 256;
        const ZOOM_FACTOR = 2;

        const dpm = MapUtils.dpi2dpm(dpi);
        const twoPiRad = 2 * Math.PI * RADIUS;
        const retval = [];
        for (let l = minZoom; l <= maxZoom; l++) {
            retval.push(
                twoPiRad / (
                    TILE_WIDTH * Math.pow(ZOOM_FACTOR, l) / dpm
                )
            );
        }
        return retval;
    },

    /**
     * Compute resolution for scale.
     * 
     * @param {number[]} scales - the list of scales.
     * @param {string} projection - the map projection.
     * @param {number} dpi - the screen resolution in dots per
     *  inch (96 by default).
     * 
     * @return {number[]} a list of resolutions corresponding to
     *  the given scales, projection and dpi.
     */
    getResolutionsForScales(scales, projection, dpi = DEFAULT_SCREEN_DPI) {
        const dpu = MapUtils.dpi2dpu(dpi, projection);
        return scales.map((scale) => scale / dpu);
    },

    /**
     * Calculates the best fitting zoom level for the given extent.
     *
     * Depending on the `allowFractionalZoom` configuration, the returned
     * zoom level can be fractional (a real number) or it will be one that
     * matches one of the `resolutions` (an integer).
     * 
     * @param {[number, number, number, number]} extent - the
     *  bounding box as an array of `[minx, miny, maxx, maxy]`.
     * @param {number[]} resolutions - the list of available map resolutions.
     * @param {{width: number, height: number}} mapSize - current size
     *  of the map in pixels.
     * @param {number} minZoom - minimum allowed zoom level (integer >= 0).
     * @param {number} maxZoom - maximum allowed zoom level (integer).
     * 
     * @return {number} the zoom level fitting the extent
     */
    getZoomForExtent(extent, resolutions, mapSize, minZoom, maxZoom) {
        const wExtent = extent[2] - extent[0];
        const hExtent = extent[3] - extent[1];

        const xResolution = Math.abs(wExtent / mapSize.width);
        const yResolution = Math.abs(hExtent / mapSize.height);
        const extentResolution = Math.max(xResolution, yResolution);

        if (ConfigUtils.getConfigProp("allowFractionalZoom") === true) {
            return Math.max(
                minZoom,
                Math.min(
                    this.computeZoom(resolutions, extentResolution),
                    maxZoom
                )
            );
        } else {
            const calc = resolutions.reduce((previous, resolution, index) => {
                const diff = Math.abs(resolution - extentResolution);
                return diff > previous.diff
                    ? previous
                    : { diff: diff, zoom: index };
            }, {
                diff: Number.POSITIVE_INFINITY,
                zoom: 0
            });
            return Math.max(minZoom, Math.min(calc.zoom, maxZoom));
        }
    },

    /**
     * Calculates the extent in map units for the provided
     * center and zoom level.
     * 
     * @param {[number, number]} center - the position of the center as an
     *  `[x, y]` array in map units.
     * @param {number} zoom - the (potentially fractional) zoom level. If
     *  `allowFractionalZoom` library configuration is false, the zoom
     *  level will be rounded to the nearest integer.
     * @param {number[]} resolutions - the list of map resolutions.
     * @param {{width: number, height: number}} mapSize - current size
     *  of the map in pixels.
     * 
     * @return {[number, number, number, number]} the bounding box as an
     *  array of `[minx, miny, maxx, maxy]` coordinates in map units.
     */
    getExtentForCenterAndZoom(center, zoom, resolutions, mapSize) {
        if (ConfigUtils.getConfigProp("allowFractionalZoom") !== true) {
            zoom = Math.round(zoom);
        }
        const res = this.computeForZoom(resolutions, zoom);
        const width = res * mapSize.width;
        const height = res * mapSize.height;
        return [
            center[0] - 0.5 * width,
            center[1] - 0.5 * height,
            center[0] + 0.5 * width,
            center[1] + 0.5 * height
        ];
    },

    /**
     * Transform width and height specified in meters to the units
     * of the specified projection
     *
     * The function supports projections with following units:
     * - meters;
     * - degrees (default if the projection does not define units);
     * - feet;
     * - us-feet.
     * 
     * @param {string} projection - the proj4 identifier of the projection.
     * @param {[number, number]} center - center of extent in 
     *  `EPSG:4326` (WGS 84) coordinates (degrees).
     * @param {number} width - the width of the extent in meters.
     * @param {number} height - the height of the extent in meters.
     * 
     * @throws {Error} if the projection is not supported.
     * @return {{width: number, height: number}} the width and height
     * in the units of the specified projection.
     */
    transformExtent(projection, center, width, height) {
        const units = CoordinatesUtils.getUnits(projection);
        if (units === 'ft') {
            return { 
                width: width / METERS_PER_UNIT.ft, 
                height: height / METERS_PER_UNIT.ft 
            };
        } else if (units === 'us-ft') {
            return { 
                width: width / METERS_PER_UNIT['us-ft'], 
                height: height / METERS_PER_UNIT['us-ft'] 
            };
        } else if (units === 'degrees') {
            // https://en.wikipedia.org/wiki/Geographic_coordinate_system#Length_of_a_degree
            const phi = center[1] / 180 * Math.PI;
            const latPerM = (
                111132.92 - 
                559.82 * Math.cos(2 * phi) + 
                1.175 * Math.cos(4 * phi) - 
                0.0023 * Math.cos(6 * phi)
            );
            const lonPerM = (
                111412.84 * Math.cos(phi) - 
                93.5 * Math.cos(3 * phi) + 
                0.118 * Math.cos(5 * phi)
            );
            return { width: width / lonPerM, height: height / latPerM };
        }
        return { width, height };
    },

    /**
     * Compute the scale or resolution matching a(possibly fractional)
     * zoom level.
     *
     * @param {number[]} list - The list of scales or resolutions.
     * @param {number} zoomLevel - The zoom level (integer or fractional).
     * 
     * @return Scale of resolution matching `zoomLevel`
     */
    computeForZoom(list, zoomLevel) {
        if (ConfigUtils.getConfigProp("allowFractionalZoom") !== true) {
            return list[Math.min(list.length - 1, Math.round(zoomLevel))];
        }
        zoomLevel = Math.max(zoomLevel, 0);
        const upper = Math.ceil(zoomLevel);
        const lower = Math.floor(zoomLevel);
        if (upper >= list.length) {
            return list[list.length - 1];
        }
        const frac = zoomLevel - lower;
        return list[lower] * (1 - frac) + list[upper] * frac;
    },

    /**
     * Compute the (possibly fractional) zoom level matching the
     * specified scale or resolution.
     *
     * @param {number[]} list - The list of scales or resolutions.
     * @param {number} value - The scale or resolution.
     * 
     * @return Zoom level matching the specified scale or resolution.
     */
    computeZoom(list, value) {
        if (ConfigUtils.getConfigProp("allowFractionalZoom") === true) {
            let index = 0;
            for (let i = 1; i < list.length - 1; ++i) {
                if (value <= list[i]) {
                    index = i;
                }
            }
            return index + (value - list[index]) / (list[index + 1] - list[index]);
        } else {
            let closestVal = Math.abs(value - list[0]);
            let closestIdx = 0;
            for (let i = 1; i < list.length; ++i) {
                const currVal = Math.abs(value - list[i]);
                if (currVal < closestVal) {
                    closestVal = currVal;
                    closestIdx = i;
                }
            }
            return closestIdx;
        }
    },

    /**
     * Convert degrees to radians
     * 
     * @param {number} degrees - the value to convert
     * @return {number} in radians
     */
    degreesToRadians(degrees) {
        const pi = Math.PI;
        return degrees * (pi / 180);
    }
};

export default MapUtils;

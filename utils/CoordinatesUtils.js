/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import Proj4js from 'proj4';
import ol from 'openlayers';

/**
 * Internal singleton that maps CRS codes to human readable labels.
 * @private
 */
const crsLabels = {
    "EPSG:4326": "WGS 84",
    "EPSG:3857": "WGS 84 / Pseudo Mercator"
};

/**
 * Utility functions for coordinate handling and transformations.
 * 
 * @namespace
 */
const CoordinatesUtils = {
    /**
     * Register names for CRS codes.
     *
     * @param {Object.<string, string>} labels - object with
     *  key/value pairs with CRS code and label
     * @see {@link CoordinatesUtils.getCrsLabel}
     * @see {@link CoordinatesUtils.getAvailableCRS}
     */
    setCrsLabels(labels) {
        Object.assign(crsLabels, labels);
    },


    /**
     * Return the label for a given CRS code. If no label is found, the CRS
     * code is returned.
     *
     * @param {string} crs - the CRS code
     * 
     * @returns {string} the label for the given CRS code
     * @see {@link CoordinatesUtils.setCrsLabels}
     * @see {@link CoordinatesUtils.getAvailableCRS}
     */
    getCrsLabel(crs) {
        return crsLabels[crs] || crs;
    },


    /**
     * Return the list of available CRS codes.
     * 
     * The `label` property of each CRS code is set to the
     * previously registered label of the CRS code, if available.
     *
     * @returns {Object.<string, {label: string}>} the list of available
     *  CRS codes
     * @see {@link CoordinatesUtils.setCrsLabels}
     * @see {@link CoordinatesUtils.getCrsLabel}
     */
    getAvailableCRS() {
        const crsList = {};
        for (const a in Proj4js.defs) {
            if (Object.prototype.hasOwnProperty.call(Proj4js.defs, a)) {
                crsList[a] = { label: crsLabels[a] || a };
            }
        }
        return crsList;
    },


    /**
     * Return the string representing the units of a projection.
     * 
     * @param {string} projection - the projection code, e.g. 'EPSG:3857'
     * 
     * @returns {import("ol/proj/Units").Units} the units of the projection 
     *  (e.g. 'degrees' or 'm')
     * @throws {Error} if the projection is unknown
     */
    getUnits(projection) {
        const proj = ol.proj.get(projection);
        if (!proj) {
            throw new Error(`Invalid projection: ${projection}`);
        }
        return proj.getUnits() || 'degrees';
    },


    /**
     * Return the string representing the orientation of the axis.
     * 
     * @param {string} projection - the projection code, e.g. 'EPSG:3857'
     * 
     * @returns {string} the string indicating the orientation
     *  (e.g. 'enu' or 'neu')
     * @throws {Error} if the projection is unknown
     * @see {@link https://openlayers.org/en/v7.5.2/apidoc/module-ol_proj_Projection-Projection.html#getAxisOrientation}
     */
    getAxisOrder(projection) {
        const proj = ol.proj.get(projection);
        if (!proj) {
            throw new Error("Invalid projection: " + projection);
        }
        return proj.getAxisOrientation() || 'enu';
    },


    /**
     * Convert coodinates between different projections.
     * 
     * If the projections are the same a new point (array) is returned with
     * same coordinates as the input point.
     * If the conversion cannot be performed a [0, 0] result is returned.
     * If either source or destination are not set (empty string,
     * undefined, null) then `null` is returned.
     * 
     * @param {ol.Coordinate} point - the point to project
     * @param {ol.ProjectionLike} source - projection of the source point
     * @param {ol.ProjectionLike} dest - the destination CRS code
     * @returns {ol.Coordinate} the transformed point
     */
    reproject(point, source, dest) {
        if (source === dest) {
            return [...point];
        }
        if (source && dest) {
            let transformed = null;
            try {
                transformed = ol.proj.transform(point, source, dest);
            } catch (e) {
                transformed = [0, 0];
            }
            return transformed;
        }
        return null;
    },


    /**
     * Reprojects a bounding box.
     * 
     * The function simply converts the two corners of
     * the bounding box.
     *
     * @param {number[]} bbox - The box to transform
     *  as an array of [minx, miny, maxx, maxy]
     * @param {string} source - SRS of the given bbox
     * @param {string} dest - SRS of the returned bbox
     *
     * @returns {number[]} The result as an array 
     *  of [minx, miny, maxx, maxy]
     */
    reprojectBbox(bbox, source, dest) {
        const sw = CoordinatesUtils.reproject([bbox[0], bbox[1]], source, dest);
        const ne = CoordinatesUtils.reproject([bbox[2], bbox[3]], source, dest);
        return [...sw, ...ne];
    },


    /**
     * Calculate the direction (azimuth) between two points in degrees.
     * 
     * @param {ol.Coordinate} p1 - the first point
     * @param {ol.Coordinate} p2 - the second point
     * @param {string} pj - the projection of the points
     * 
     * @returns {number} the direction in degrees, in interval [0..360)
     */
    calculateAzimuth(p1, p2, pj) {
        // Convert both points to WGS 84. The result is in degrees.
        const p1proj = CoordinatesUtils.reproject(p1, pj, 'EPSG:4326');
        const p2proj = CoordinatesUtils.reproject(p2, pj, 'EPSG:4326');

        // Convert to radians.
        const lon1 = p1proj[0] * Math.PI / 180.0;
        const lat1 = p1proj[1] * Math.PI / 180.0;
        const lon2 = p2proj[0] * Math.PI / 180.0;
        const lat2 = p2proj[1] * Math.PI / 180.0;

        // Intermediate values.
        const dLon = lon2 - lon1;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = (
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
        );

        // Compute the azimuth in radians and convert it in degrees.
        const azimuth = (((Math.atan2(y, x) * 180.0 / Math.PI) + 360) % 360);
        return azimuth;
    },


    /**
     * Extend an extent given another one.
     *
     * The function assumes (but does not check) that the
     * two extents are in the same projection and the given extents
     * are valid (minx <= maxx, miny <= maxy).
     * 
     * @param {number[]} extent1 - First bounding
     *  box as an array of [minx, miny, maxx, maxy]
     * @param {number[]} extent2 - Second bounding
     *  box as an array of [minx, miny, maxx, maxy]
     * 
     * @returns {number[]} The common bounding
     *  box as an array of [minx, miny, maxx, maxy]
     * @see {@link CoordinatesUtils.isValidExtent}
     */
    extendExtent(extent1, extent2) {
        return [
            Math.min(extent1[0], extent2[0]),
            Math.min(extent1[1], extent2[1]),
            Math.max(extent1[2], extent2[2]),
            Math.max(extent1[3], extent2[3])
        ];
    },


    /**
     * Check extent validity.
     * 
     * A valid extent is an array of four numbers with the following
     * constraints:
     * - minx <= maxx
     * - miny <= maxy
     * - no Infinity or -Infinity in any of its members.
     *
     * @param {number[]} extent - The bounding
     *  box as an array of [minx, miny, maxx, maxy]
     *
     * @returns {bool} True if the extent is valid, false otherwise.
     */
    isValidExtent(extent) {
        return !(
            !Array.isArray(extent) ||
            extent.length < 4 ||
            extent.indexOf(Infinity) !== -1 || extent.indexOf(-Infinity) !== -1 ||
            extent[1] >= extent[2] || extent[1] >= extent[3]
        );
    },


    /**
     * Convert a CRS string from OGC notation to EPSG notation.
     * 
     * @param {string} crsStr - The CRS string in OGC notation
     * 
     * @returns {string} The CRS string in EPSG notation.
     * @see {@link https://epsg.io/}
     * @see {@link https://www.ogc.org/about-ogc/policies/ogc-urn-policy/}
     */
    fromOgcUrnCrs(crsStr) {
        const parts = crsStr.split(":");
        if (parts.length < 2) {
            throw new Error("Invalid OGC CRS: " + crsStr);
        }
        const last = parts.slice(-1)[0];
        if (last === "CRS84") {
            return "EPSG:4326";
        }
        return "EPSG:" + last;
    },


    /**
     * Convert a CRS string from EPSG notation to OGC notation.
     * 
     * @param {string} crsStr - The CRS string in EPSG notation
     * 
     * @returns {string} The CRS string in OGC notation
     * @throws {Error} if the CRS string is invalid
     * @see {@link https://epsg.io/}
     * @see {@link https://www.ogc.org/about-ogc/policies/ogc-urn-policy/}
     */
    toOgcUrnCrs(crsStr) {
        const parts = crsStr.split(":");
        if (parts.length !== 2) {
            throw new Error("Invalid CRS: " + crsStr);
        }
        return "urn:ogc:def:crs:" + parts[0] + "::" + parts[1];
    }
};

export default CoordinatesUtils;

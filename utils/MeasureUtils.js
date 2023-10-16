/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from "./CoordinatesUtils";
import LocaleUtils from './LocaleUtils';


/**
 * The geometry types supported by the measurement tool.
 * @enum {import('qwc2/typings').MeasGeomTypes}
 */
export const MeasGeomTypes = {
    POINT: 'Point',
    LINE_STRING: 'LineString',
    POLYGON: 'Polygon',
    ELLIPSE: 'Ellipse',
    SQUARE: 'Square',
    BOX: 'Box',
    CIRCLE: 'Circle',
    BEARING: 'Bearing',
}


/**
 * Length units used for measurements on the map.
 * @enum {string}
 */
export const LengthUnits = {
    FEET: "ft",
    METRES: "m",
    KILOMETRES: "km",
    MILES: "mi",
};


/**
 * Area units used for measurements on the map.
 * @enum {string}
 */
export const AreaUnits = {
    SQUARE_FEET: "sqft",
    SQUARE_METRES: "sqm",
    SQUARE_KILOMETRES: "sqkm",
    SQUARE_MILES: "sqmi",
    HECTARES: "ha",
    ACRES: "acre",
};


/**
 * All units used for measurements on the map,
 * including those for length and area.
 * 
 * @enum {string}
 */
export const MeasUnits = {
    ...LengthUnits,
    ...AreaUnits,

    /**
     * The metric unit appropriate for the given context.
     */
    METRIC: 'metric',

    /**
     * The imperial unit appropriate for the given context.
     */
    IMPERIAL: 'imperial',
};


/**
 * Utility functions for measurements on the map.
 * 
 * @namespace
 */
const MeasureUtils = {

    /**
     * Computes a DD° MM' SS'' formatted bearing value from an
     * azimuth value.
     * 
     * The azimuth's 0 value is north oriented and increases clockwise.
     * 
     * @param {number} azimuth - the azimuth value in degrees
     * 
     * @returns {string} formatted bearing value
     */
    getFormattedBearingValue(azimuth) {
        let bearing = "";
        if (azimuth >= 0 && azimuth < 90) {
            bearing = "N " + this.degToDms(azimuth) + " E";
        } else if (azimuth > 90 && azimuth <= 180) {
            bearing = "S " + this.degToDms(180.0 - azimuth) + " E";
        } else if (azimuth > 180 && azimuth < 270) {
            bearing = "S " + this.degToDms(azimuth - 180.0) + " W";
        } else if (azimuth >= 270 && azimuth <= 360) {
            bearing = "N " + this.degToDms(360 - azimuth) + " W";
        }
        return bearing;
    },

    /**
     * Pretty-print coordinates.
     * 
     * The function transforms the coordinates to the given CRS and
     * formats them according to the given number of decimals
     * and the current locale.
     * 
     * @param {number[]} coo - the list of coordinates to format (
     *  can be any length if `srcCrs` == `dstCrs`, otherwise a
     *  two-element list of x and y coordinates is expected).
     * @param {string} srcCrs - the CRS of the `coo` parameter
     * @param {string} dstCrs - the CRS to use for formatting
     * @param {number} decimals - the number of decimals to use
     *  (-1 to automatically set the number of decimals)
     */
    getFormattedCoordinate(coo, srcCrs = null, dstCrs = null, decimals = -1) {
        if (srcCrs && dstCrs && srcCrs !== dstCrs) {
            coo = CoordinatesUtils.reproject(coo, srcCrs, dstCrs);
        }
        if (decimals < 0) {
            // Automatically set decimals
            if (CoordinatesUtils.getUnits(dstCrs) === 'degrees') {
                decimals = 4;
            } else {
                decimals = 0;
            }
        }
        return coo.map(
            ord => LocaleUtils.toLocaleFixed(ord, decimals)
        ).join(", ");
    },

    /**
     * Pretty-print a time interval.
     * 
     * @param {number} valueSeconds - the time interval in seconds
     * 
     * @returns {string} the formatted time interval
     */
    formatDuration(valueSeconds) {
        return new Date(valueSeconds * 1000).toISOString().slice(11, 19);
    },

    /**
     * Pretty-print a measurement value.
     * 
     * If the unit is among the predefined ones, an appropriate suffix
     * is appended to the formatted value.
     * 
     * If the unit is not among the predefined ones, the
     * value is formatted using the given number of decimals and
     * the current locale, with `unit` appended to it.
     * 
     * @param {number} valueMetric - the measurement value in the
     * metric system
     * @param {boolean} isArea - whether the measurement is an area
     *  or a length
     * @param {MeasUnits} unit - the unit to use for formatting (default: metric)
     * @param {number} decimals - the number of decimals to use
     *  (2 by default)
     * @param {boolean} withUnit - whether to append the unit to the
     * formatted value (true by default)
     * 
     * @returns {string} the formatted measurement value
     */
    formatMeasurement(
        valueMetric, isArea, unit = 'metric', decimals = 2, withUnit = true
    ) {
        let result = '';
        let unitlabel = unit;
        switch (unit) {
            case MeasUnits.METRIC:
                if (isArea) {
                    if (valueMetric > 1000000) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric / 1000000, decimals
                        );
                        unitlabel = 'km²';
                    } else if (valueMetric > 10000) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric / 10000, decimals
                        );
                        unitlabel = 'ha';
                    } else {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric, decimals
                        );
                        unitlabel = 'm²';
                    }
                } else {
                    if (valueMetric > 1000) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric / 1000, decimals
                        );
                        unitlabel = 'km';
                    } else {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric, decimals
                        );
                        unitlabel = 'm';
                    }
                }
                break;
            case MeasUnits.IMPERIAL:
                if (isArea) {
                    if (valueMetric > 2.58999 * 1000000) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric * 0.000000386102159, decimals
                        );
                        unitlabel = 'mi²';
                    } else if (valueMetric > 4046.86) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric * 0.0001, decimals
                        );
                        unitlabel = 'acre';
                    } else {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric * 10.7639, decimals
                        );
                        unitlabel = 'ft²';
                    }
                } else {
                    if (valueMetric > 1609.34) {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric * 0.000621371, decimals
                        );
                        unitlabel = 'mi';
                    } else {
                        result = LocaleUtils.toLocaleFixed(
                            valueMetric * 3.28084, decimals
                        );
                        unitlabel = 'ft';
                    }
                }
                break;
            case MeasUnits.METRES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric, decimals
                );
                break;
            case MeasUnits.FEET:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 3.28084, decimals
                );
                break;
            case MeasUnits.KILOMETRES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.001, decimals
                );
                break;
            case MeasUnits.MILES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.000621371, decimals
                );
                break;
            case MeasUnits.SQUARE_METRES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric, decimals);
                unitlabel = 'm²';
                break;
            case MeasUnits.SQUARE_FEET:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 10.7639, decimals);
                unitlabel = 'ft²';
                break;
            case MeasUnits.SQUARE_KILOMETRES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.000001, decimals);
                unitlabel = 'km²';
                break;
            case MeasUnits.SQUARE_MILES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.000000386102159, decimals
                );
                unitlabel = 'mi²';
                break;
            case MeasUnits.HECTARES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.0001, decimals
                );
                break;
            case MeasUnits.ACRES:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric * 0.000247105381467, decimals
                );
                break;
            default:
                result = LocaleUtils.toLocaleFixed(
                    valueMetric, decimals
                );
                break;
        }
        if (withUnit) {
            result += ' ' + unitlabel;
        }
        return result;
    },

    /**
     * Pretty-print a length value.
     * 
     * If the unit is among the predefined ones, an appropriate suffix
     * is appended to the formatted value.
     * 
     * In cases when the unit is not among the predefined ones, the
     * value is formatted using the given number of decimals and
     * the current locale, with `unit` appended to it.
     * 
     * @param {string} unit - the unit to use for formatting
     * @param {LengthUnits} length - the length in meters
     * @param {number} decimals - the number of decimals to use
     *  (2 by default)
     * @param {boolean} withUnit - whether to append the unit to the
     *  formatted value (true by default)
     * 
     * @returns {string} the formatted length value
     */
    getFormattedLength(unit, length, decimals = 2, withUnit = true) {
        let result = '';
        switch (unit) {
            case 'm':
                result = LocaleUtils.toLocaleFixed(
                    length, decimals
                );
                break;
            case 'ft':
                result = LocaleUtils.toLocaleFixed(
                    length * 3.28084, decimals
                );
                break;
            case 'km':
                result = LocaleUtils.toLocaleFixed(
                    length * 0.001, decimals
                );
                break;
            case 'mi':
                result = LocaleUtils.toLocaleFixed(
                    length * 0.000621371, decimals
                );
                break;
            default:
                result = LocaleUtils.toLocaleFixed(
                    length, decimals
                );
                break;
        }
        if (withUnit) {
            result += ' ' + unit;
        }
        return result;
    },

    /**
     * Pretty-print an area value.
     * 
     * If the unit is among the predefined ones, an appropriate suffix
     * is appended to the formatted value.
     * 
     * In cases when the unit is not among the predefined ones, the
     * value is formatted using the given number of decimals and
     * the current locale, with `unit` appended to it.
     * 
     * @param {string} unit - the unit to use for formatting
     * @param {AreaUnits} area - the measurement value in square meters
     * @param {number} decimals - the number of decimals to use
     * (2 by default)
     * @param {boolean} withUnit - whether to append the unit to the
     * formatted value (true by default)
     * 
     * @returns {string} the formatted area value
     */
    getFormattedArea(unit, area, decimals = 2, withUnit = true) {
        let result = '';
        let unitlabel = unit;
        switch (unit) {
            case 'sqm':
                result = LocaleUtils.toLocaleFixed(
                    area, decimals
                );
                unitlabel = 'm²';
                break;
            case 'sqft':
                result = LocaleUtils.toLocaleFixed(
                    area * 10.7639, decimals
                );
                unitlabel = 'ft²';
                break;
            case 'sqkm':
                result = LocaleUtils.toLocaleFixed(
                    area * 0.000001, decimals
                );
                unitlabel = 'km²';
                break;
            case 'sqmi':
                result = LocaleUtils.toLocaleFixed(
                    area * 0.000000386102159, decimals
                );
                unitlabel = 'mi²';
                break;
            case 'ha':
                result = LocaleUtils.toLocaleFixed(
                    area * 0.0001, decimals
                );
                break;
            case 'acre':
                result = LocaleUtils.toLocaleFixed(
                    area * 0.000247105381467, decimals
                );
                break;
            default:
                result = LocaleUtils.toLocaleFixed(
                    area, decimals
                );
                break;
        }
        if (withUnit) {
            result += ' ' + unitlabel;
        }
        return result;
    },

    /**
     * Converts a decimal degree value to a DD° MM' SS'' formatted
     * string.
     * 
     * Note that the string has an extra space at the end.
     * 
     * @param {number} deg - the decimal degree value to convert
     * 
     * @returns {string} the degrees-minutes-seconds formatted value
     */
    degToDms(deg) {
        const d = Math.floor(deg);
        const minfloat = (deg - d) * 60;
        const m = Math.floor(minfloat);
        const secfloat = (minfloat - m) * 60;
        const s = Math.floor(secfloat);

        return ("" + d + "° " + m + "' " + s + "'' ");
    },

    /**
     * Changes the properties of a feature to reflect the current
     * measurement settings.
     * 
     * The function changes following properties of the feature:
     * - `measurements` - an object containing the measurement values
     * - `label` - a string containing the formatted measurement value
     * - `segment_labels` - an array of strings containing the formatted
     *  measurement values for each segment of the line
     * 
     * Note that the function silently ignores an unknown
     * geometry type.
     * 
     * @param {import('ol').Feature} feature - the feature to update
     * @param {import('qwc2/typings').MeasGeomTypes} geomType - the type
     *  of the feature's geometry
     * @param {string} featureCrs - the CRS of the feature's geometry
     * @param {import('qwc2/typings').UpdateFeatMeasSetting} settings - the 
     *  settings to use for updating the feature
     */
    updateFeatureMeasurements(feature, geomType, featureCrs, settings) {
        const geodesic = ConfigUtils.getConfigProp("geodesicMeasurements");
        const measurements = {
            lenUnit: settings.lenUnit,
            areaUnit: settings.areaUnit
        };
        feature.set('label', '');
        feature.set('segment_labels', undefined);
        const geom = feature.getGeometry();

        if (geomType === MeasGeomTypes.POINT) {
            feature.set('label', MeasureUtils.getFormattedCoordinate(
                geom.getCoordinates(), settings.mapCrs, settings.displayCrs)
            );

        } else if (geomType === MeasGeomTypes.LINE_STRING) {
            const lengths = MeasureUtils.computeSegmentLengths(
                geom.getCoordinates(), featureCrs, geodesic
            );
            measurements.segment_lengths = lengths;
            measurements.length = lengths.reduce((sum, len) => sum + len, 0);
            feature.set('segment_labels', lengths.map(
                length => MeasureUtils.formatMeasurement(
                    length, false, settings.lenUnit, settings.decimals
                )
            ));

        } else if (
            [
                MeasGeomTypes.ELLIPSE,
                MeasGeomTypes.POLYGON,
                MeasGeomTypes.SQUARE,
                MeasGeomTypes.BOX
            ].includes(geomType)
        ) {
            const area = MeasureUtils.computeArea(geom, featureCrs, geodesic);
            measurements.area = area;
            feature.set('label', MeasureUtils.formatMeasurement(
                area, true, settings.areaUnit, settings.decimals
            ));

        } else if (geomType === MeasGeomTypes.CIRCLE) {
            const radius = geom.getRadius();
            measurements.radius = radius;
            feature.set('label', "r = " + MeasureUtils.formatMeasurement(
                radius, false, settings.lenUnit, settings.decimals
            ));

        } else if (geomType === MeasGeomTypes.BEARING) {
            const coo = geom.getCoordinates();
            measurements.bearing = CoordinatesUtils.calculateAzimuth(
                coo[0], coo[1], featureCrs
            );
            feature.set('label', MeasureUtils.getFormattedBearingValue(
                measurements.bearing
            ));
        }
        feature.set('measurements', measurements);
    },

    /**
     * Compute the lengths of the segments of a line string.
     * 
     * The function relies on {@link CoordinatesUtils.getUnits} to
     * retrieve the units of the line's coordinates from the CRS.
     * It deals with three cases:
     * - degrees (geodesic calculations are used),
     * - feet (the coordinates are converted to meters),
     * - meters (which is assumed if the units are not degrees or feet).
     * 
     * @param {number[][]} coordinates - the coordinates of the line
     * @param {string} featureCrs - the CRS of the line's coordinates
     * @param {boolean} geodesic - whether to use geodesic calculations
     * 
     * @returns {number[]} the lengths of the line's segments in meters
     *  (or degrees if `geodesic` is true)
     */
    computeSegmentLengths(coordinates, featureCrs, geodesic) {
        const lengths = [];
        const units = CoordinatesUtils.getUnits(featureCrs);
        if (geodesic || units === 'degrees') {
            const wgsCoo = coordinates.map(
                coo => CoordinatesUtils.reproject(
                    coo, featureCrs, "EPSG:4326"
                )
            );
            for (let i = 0; i < wgsCoo.length - 1; ++i) {
                lengths.push(
                    ol.sphere.getDistance(wgsCoo[i], wgsCoo[i + 1])
                );
            }
        } else {
            const conv = units === 'feet' ? 0.3048 : 1;
            for (let i = 0; i < coordinates.length - 1; ++i) {
                const dx = coordinates[i + 1][0] - coordinates[i][0];
                const dy = coordinates[i + 1][1] - coordinates[i][1];
                lengths.push(Math.sqrt(dx * dx + dy * dy) * conv);
            }
        }
        return lengths;
    },

    /**
     * Compute the area of a polygon.
     * 
     * The function relies on {@link CoordinatesUtils.getUnits} to
     * retrieve the units of the polygon's coordinates from the CRS.
     * It deals with three cases:
     * - degrees (geodesic calculations are used),
     * - feet (the coordinates are converted to meters),
     * - meters (which is assumed if the units are not degrees or feet).
     * 
     * @param {import('ol/geom').Geometry} geometry - the polygon's geometry
     * @param {string} featureCrs - the CRS of the polygon's coordinates
     * @param {boolean} geodesic - whether to use geodesic calculations
     * 
     * @returns {number} the area of the polygon in square meters
     *  (or square degrees if `geodesic` is true)
     */
    computeArea(geometry, featureCrs, geodesic) {
        const units = CoordinatesUtils.getUnits(featureCrs);
        if (geodesic || units === 'degrees') {
            return ol.sphere.getArea(geometry, {
                projection: featureCrs
            });
        } else {
            const conv = units === 'feet' ? 0.3048 : 1;
            return geometry.getArea() * conv * conv;
        }
    }
};

export default MeasureUtils;

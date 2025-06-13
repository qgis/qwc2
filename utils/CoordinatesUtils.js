/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import ol from 'openlayers';
import Proj4js from 'proj4';

import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';

const crsLabels = {
    "EPSG:4326": "WGS 84",
    "EPSG:3857": "WGS 84 / Pseudo Mercator"
};

const CoordinatesUtils = {
    setCrsLabels(labels) {
        Object.assign(crsLabels, labels);
    },
    getAvailableCRS() {
        const crsList = {};
        for (const a in Proj4js.defs) {
            if (Object.prototype.hasOwnProperty.call(Proj4js.defs, a)) {
                crsList[a] = {label: crsLabels[a] || a};
            }
        }
        return crsList;
    },
    getUnits(projection) {
        const proj = ol.proj.get(projection);
        return proj.getUnits() || 'degrees';
    },
    getPrecision(projection) {
        const precisions = ConfigUtils.getConfigProp("projections").reduce((res, entry) => (
            {...res, [entry.code]: entry.precision ?? 0}
        ), {});
        return precisions[projection] ?? (CoordinatesUtils.getUnits(projection) === 'degrees' ? 4 : 0);
    },    
    getFormat(projection) {
        const formats = ConfigUtils.getConfigProp("projections").reduce((res, entry) => (
            { ...res, [entry.code]: entry.format ?? 'decimal' }
        ), {});
        return formats[projection];
    },
    getAddDirection(projection) {
        const directions = ConfigUtils.getConfigProp("projections").reduce((res, entry) => (
            { ...res, [entry.code]: entry.addDirection ?? 'none' }
        ), {});
        return directions[projection];
    },
    getSwapLonLat(projection) {
        const swaps = ConfigUtils.getConfigProp("projections").reduce((res, entry) => (
            { ...res, [entry.code]: entry.swapLonLat ?? false }
        ), {});
        return swaps[projection];
    },
    getAxisOrder(projection) {
        const axis = ol.proj.get(projection).getAxisOrientation();
        return axis || 'enu';
    },
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
     * @param bbox {array} [minx, miny, maxx, maxy]
     * @param source {string} SRS of the given bbox
     * @param dest {string} SRS of the returned bbox
     *
     * @return {array} [minx, miny, maxx, maxy]
     */
    reprojectBbox(bbox, source, dest) {
        if (source === dest) {
            return [...bbox];
        }
        const sw = CoordinatesUtils.reproject([bbox[0], bbox[1]], source, dest);
        const ne = CoordinatesUtils.reproject([bbox[2], bbox[3]], source, dest);
        return [...sw, ...ne];
    },
    calculateAzimuth(p1, p2, pj) {
        const p1proj = CoordinatesUtils.reproject(p1, pj, 'EPSG:4326');
        const p2proj = CoordinatesUtils.reproject(p2, pj, 'EPSG:4326');
        const lon1 = p1proj[0] * Math.PI / 180.0;
        const lat1 = p1proj[1] * Math.PI / 180.0;
        const lon2 = p2proj[0] * Math.PI / 180.0;
        const lat2 = p2proj[1] * Math.PI / 180.0;
        const dLon = lon2 - lon1;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const azimuth = (((Math.atan2(y, x) * 180.0 / Math.PI) + 360 ) % 360 );

        return azimuth;
    },
    /**
     * Extend an extent given another one
     *
     * @param extent1 {array} [minx, miny, maxx, maxy]
     * @param extent2 {array} [minx, miny, maxx, maxy]
     *
     * @return {array} [minx, miny, maxx, maxy]
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
     * Check extent validity
     *
     * @param extent {array} [minx, miny, maxx, maxy]
     *
     * @return {bool}
     */
    isValidExtent(extent) {
        return extent.length === 4 && !(
            extent.indexOf(Infinity) !== -1 || extent.indexOf(-Infinity) !== -1 ||
            extent.indexOf(NaN) !== -1 ||
            extent[0] >= extent[2] || extent[1] >= extent[3]
        );
    },
    fromOgcUrnCrs(crsStr) {
        if (crsStr.endsWith(":CRS84")) {
            return "EPSG:4326";
        }
        const parts = crsStr.split(":");
        return "EPSG:" + parts.slice(-1);
    },
    toOgcUrnCrs(crsStr) {
        const parts = crsStr.split(":");
        return "urn:ogc:def:crs:" + parts[0] + "::" + parts[1];
    },
    getFormattedCoordinate(coo, srcCrs, dstCrs = null, options = {}) {
        const {
            decimals = CoordinatesUtils.getPrecision(dstCrs ?? srcCrs),
            units = CoordinatesUtils.getUnits(dstCrs ?? srcCrs),
            format = units !== 'degrees' ? 'decimal' : CoordinatesUtils.getFormat(dstCrs ?? srcCrs),
            addDirection = CoordinatesUtils.getAddDirection(dstCrs ?? srcCrs),
            swapLonLat = CoordinatesUtils.getSwapLonLat(dstCrs ?? srcCrs)
        } = options;
        if (srcCrs && dstCrs && srcCrs !== dstCrs) {
            coo = CoordinatesUtils.reproject(coo, srcCrs, dstCrs);
        }
        if (swapLonLat) coo = [coo[1], coo[0]];
        const toDMS = (coord, decimals) => {
            const deg = Math.floor(Math.abs(coord));
            const minFull = (Math.abs(coord) - deg) * 60;
            const min = Math.floor(minFull);
            const sec = ((minFull - min) * 60).toFixed(decimals);
            return `${deg}° ${min}' ${sec}\"`;
        };
        const toDM = (coord, decimals) => {
            const deg = Math.floor(Math.abs(coord));
            const min = ((Math.abs(coord) - deg) * 60).toFixed(decimals);
            return `${deg}° ${min}'`;
        };
        const formatCoordinate = (value, isLat) => {
            let direction = '';
            if (addDirection !== 'none') {
                direction = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
            }
            let formatted;
            switch (format) {
                case 'dms':
                    formatted = toDMS(value, decimals);
                    break;
                case 'dm':
                    formatted = toDM(value, decimals);
                    break;
                default:
                    formatted = LocaleUtils.toLocaleFixed(Math.abs(value), decimals);
            }
            if (addDirection === 'prefix') {
                return `${direction}${formatted}`;
            } else if (addDirection === 'suffix') {
                return `${formatted}${direction}`;
            }
            return formatted;
        };
        return coo.map((coord, idx) => formatCoordinate(coord, swapLonLat ? idx === 0 : idx === 1)).join(", ");
    }
};

export default CoordinatesUtils;

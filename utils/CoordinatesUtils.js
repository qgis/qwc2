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
        return !(
            extent.indexOf(Infinity) !== -1 || extent.indexOf(-Infinity) !== -1 ||
            extent[1] >= extent[2] || extent[1] >= extent[3]
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
    }
};

export default CoordinatesUtils;

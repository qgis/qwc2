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

const commonEsriWktLookup = {
    "EPSG:4326": 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
    "EPSG:3857": 'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]'
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
    getProjectionConfig(projection) {
        const config = ConfigUtils.getConfigProp("projections").reduce((res, entry) => {
            res[entry.code] = {
                format: entry.format ?? 'decimal',
                addDirection: entry.addDirection ?? 'none',
                swapLonLat: entry.swapLonLat ?? false
            };
            return res;
        }, {});
        return config[projection] ?? { format: 'decimal', addDirection: 'none', swapLonLat: false };
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
            } catch {
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
    getEsriWktFromCrs(crsStr) {
        const epsgCode = crsStr.startsWith("EPSG:") ? crsStr : CoordinatesUtils.fromOgcUrnCrs(crsStr);

        const projections = ConfigUtils.getConfigProp("projections") || [];
        const configProjection = projections.find(proj => proj.code === epsgCode);
        if (configProjection && configProjection.esriWkt) {
            return configProjection.esriWkt;
        }

        if (commonEsriWktLookup[epsgCode]) {
            return commonEsriWktLookup[epsgCode];
        }

        /* eslint-disable-next-line */
        console.warn(`No ESRI WKT definition found for ${epsgCode}. Shapefile export may not include projection information. Consider adding an 'esriWkt' property to the projection in config.json.`);
        return null;
    },
    getFormattedCoordinate(coo, srcCrs, dstCrs = null, options = {}) {
        const units = CoordinatesUtils.getUnits(dstCrs ?? srcCrs);
        const decimals = options.decimals ?? CoordinatesUtils.getPrecision(dstCrs ?? srcCrs);
        const {
            format,
            addDirection,
            swapLonLat
        } = (() => {
            const config = CoordinatesUtils.getProjectionConfig(dstCrs ?? srcCrs);
            return {
                format: units !== 'degrees' ? 'decimal' : config.format,
                addDirection: config.addDirection,
                swapLonLat: config.swapLonLat
            };
        })();

        if (srcCrs && dstCrs && srcCrs !== dstCrs) {
            coo = CoordinatesUtils.reproject(coo, srcCrs, dstCrs);
        }
        if (swapLonLat) {
            coo = [coo[1], coo[0]];
        }
        const toDMS = (coord) => {
            const deg = Math.floor(Math.abs(coord));
            const minFull = (Math.abs(coord) - deg) * 60;
            const min = Math.floor(minFull);
            const sec = ((minFull - min) * 60).toFixed(decimals);
            return `${deg}° ${min}' ${sec}"`;
        };
        const toDM = (coord) => {
            const deg = Math.floor(Math.abs(coord));
            const min = ((Math.abs(coord) - deg) * 60).toFixed(decimals);
            return `${deg}° ${min}'`;
        };
        const formatCoordinate = (value, isLat) => {
            let direction = '';
            if (addDirection !== 'none') {
                if (isLat) {
                    direction = value >= 0 ? 'N' : 'S';
                } else {
                    direction = value >= 0 ? 'E' : 'W';
                }
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

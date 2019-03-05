/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const Proj4js = require('proj4').default;
const assign = require('object-assign');
const ol = require('openlayers');

let crsLabels = {
    "EPSG:4326": "WGS 84",
    "EPSG:3857": "WGS 84 / Pseudo Mercator"
};

var CoordinatesUtils = {
    setCrsLabels(labels) {
        assign(crsLabels, labels)
    },
    getCrsLabels() {
        return crsLabels;
    },
    getUnits: function(projection) {
        const proj = new Proj4js.Proj(projection);
        return proj.units || 'degrees';
    },
    getAxisOrder: function(projection) {
        const axis = ol.proj.get(projection).getAxisOrientation()
        return axis || 'enu'
    },
    reproject: function(point, source, dest) {
        if(source === dest) {
            return [...point];
        }
        const sourceProj = Proj4js.defs(source) ? new Proj4js.Proj(source) : null;
        const destProj = Proj4js.defs(dest) ? new Proj4js.Proj(dest) : null;
        if (sourceProj && destProj) {
            let p = Array.isArray(point) ? Proj4js.toPoint(point) : Proj4js.toPoint([point.x, point.y]);
            let transformed = null;
            try {
                transformed = Proj4js.transform(sourceProj, destProj, p);
            } catch(e) {
                transformed = {x: 0, y: 0};
            }
            return [transformed.x, transformed.y];
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
    reprojectBbox: function(bbox, source, dest) {
        let sw = CoordinatesUtils.reproject([bbox[0], bbox[1]], source, dest);
        let ne = CoordinatesUtils.reproject([bbox[2], bbox[3]], source, dest);
        return [...sw, ...ne];
    },
    getCompatibleSRS(srs, allowedSRS) {
        if (srs === 'EPSG:900913' && !allowedSRS['EPSG:900913'] && allowedSRS['EPSG:3857']) {
            return 'EPSG:3857';
        }
        if (srs === 'EPSG:3857' && !allowedSRS['EPSG:3857'] && allowedSRS['EPSG:900913']) {
            return 'EPSG:900913';
        }
        return srs;
    },
    normalizeSRS: function(srs, allowedSRS) {
        const result = (srs === 'EPSG:900913' ? 'EPSG:3857' : srs);
        if (allowedSRS && !allowedSRS[result]) {
            return CoordinatesUtils.getCompatibleSRS(result, allowedSRS);
        }
        return result;
    },
    isAllowedSRS(srs, allowedSRS) {
        return allowedSRS[CoordinatesUtils.getCompatibleSRS(srs, allowedSRS)];
    },
    getAvailableCRS: function() {
        let crsList = {};
        for (let a in Proj4js.defs) {
            if (Proj4js.defs.hasOwnProperty(a)) {
                crsList[a] = {label: crsLabels[a] || a};
            }
        }
        return crsList;
    },
    calculateAzimuth: function(p1, p2, pj) {
        var p1proj = CoordinatesUtils.reproject(p1, pj, 'EPSG:4326');
        var p2proj = CoordinatesUtils.reproject(p2, pj, 'EPSG:4326');
        var lon1 = p1proj[0] * Math.PI / 180.0;
        var lat1 = p1proj[1] * Math.PI / 180.0;
        var lon2 = p2proj[0] * Math.PI / 180.0;
        var lat2 = p2proj[1] * Math.PI / 180.0;
        var dLon = lon2 - lon1;
        var y = Math.sin(dLon) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        var azimuth = (((Math.atan2(y, x) * 180.0 / Math.PI) + 360 ) % 360 );

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
    extendExtent: function(extent1, extent2) {
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
    isValidExtent: function(extent) {
        return !(
            extent.indexOf(Infinity) !== -1 || extent.indexOf(-Infinity) !== -1 ||
            extent[1] >= extent[2] || extent[1] >= extent[3]
        );
    },
    calculateCircleCoordinates: function(center, radius, sides, rotation) {
        let angle = Math.PI * ((1 / sides) - (1 / 2));

        if (rotation) {
            angle += (rotation / 180) * Math.PI;
        }

        let rotatedAngle; let x; let y;
        let points = [[]];
        for (let i = 0; i < sides; i++) {
            rotatedAngle = angle + (i * 2 * Math.PI / sides);
            x = center[0] + (radius * Math.cos(rotatedAngle));
            y = center[1] + (radius * Math.sin(rotatedAngle));
            points[0].push([x, y]);
        }

        points[0].push(points[0][0]);
        return points;
    }
};

module.exports = CoordinatesUtils;

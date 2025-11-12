/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from "axios";

import ConfigUtils from "./ConfigUtils";

/**
 * Interface for querying elevations/height profiles
 */
const ElevationInterface = {
    /**
     * Query the elevation at the specified position
     *
     * * `pos`: query position, as tuple `[x, y]`
     * * `crs`: CRS of the query position, as an EPSG string
     *
     * Returns: a promise which resolves to an elevation value (in meteres)
     *  or an object with a `list` property containing an array of objects with
     *  `elevation` and `dataset` properties, if multiple datasets are available.
     */
    getElevation(pos, crs) {
        return new Promise((resolve, reject) => {
            const serviceUrl = ConfigUtils.getConfigProp("elevationServiceUrl", null, "").replace(/\/$/, '');
            if (!serviceUrl) {
                reject(null);
                return;
            }
            axios.get(serviceUrl + '/getelevation', {params: {pos: pos.join(","), crs}}).then(response => {
                resolve(response.data.elevation ?? { list: response.data.elevation_list });
            }).catch((e) => {
                reject(String(e));
            });
        });
    },
    /**
     * Query the elevation profile along the specified line
     *
     * * `coordinates`: line coordinates `[[x1, y1], [x2, y2], ...]`
     * * `distances`: distances of the line segments `[dist1, dist2, ...]`
     * * `crs`: CRS of the line coordinates, as an EPSG string
     * * `samples`: the number of samples
     *
     * Returns a promise which resolves to the elevation values `[z1, z2, ...]`
     *  or an object with a `list` property containing an array of objects with
     *  `elevations` and `dataset` properties, if multiple datasets are available.
     */
    getProfile(coordinates, distances, crs, samples) {
        return new Promise((resolve, reject) => {
            const serviceUrl = ConfigUtils.getConfigProp("elevationServiceUrl", null, "").replace(/\/$/, '');
            if (!serviceUrl) {
                reject(null);
                return;
            }
            axios.post(serviceUrl + '/getheightprofile', {coordinates, distances, projection: crs, samples}).then(response => {
                resolve(response.data.elevations || { list: response.data.elevations_list });
            }).catch((e) => {
                const error = e.response?.data?.error ? e.response.data.error : e;
                /* eslint-disable-next-line */
                console.log("Query failed: " + error);
                reject(String(error));
            });
        });
    }
};

export function getElevationInterface() {
    return window.QWC2ElevationInterface ?? ElevationInterface;
}

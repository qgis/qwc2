/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const MeasureUtils = {
    getFormattedBearingValue(azimuth = 0) {
        let bearing = "";
        if (azimuth >= 0 && azimuth < 90) {
            bearing = "N " + this.degToDms(azimuth) + " E";
        } else if (azimuth > 90 && azimuth <= 180) {
            bearing = "S " + this.degToDms(180.0 - azimuth) + " E";
        } else if (azimuth > 180 && azimuth < 270) {
            bearing = "S " + this.degToDms(azimuth - 180.0 ) + " W";
        } else if (azimuth >= 270 && azimuth <= 360) {
            bearing = "N " + this.degToDms(360 - azimuth ) + " W";
        }
        return bearing;
    },
    getFormattedLength(unit = "m", length = 0) {
        switch (unit) {
        case 'm':
            return length;
        case 'ft':
            return this.mToft(length);
        case 'km':
            return this.mTokm(length);
        case 'mi':
            return this.mTomi(length);
        default:
            return length;
        }
    },
    getFormattedArea(unit = "sqm", area = 0) {
        switch (unit) {
        case 'sqm':
            return area;
        case 'sqft':
            return this.sqmTosqft(area);
        case 'sqkm':
            return this.sqmTosqkm(area);
        case 'sqmi':
            return this.sqmTosqmi(area);
        case 'ha':
            return this.sqmToha(area);
        default:
            return area;
        }
    },
    degToDms(deg) {
        // convert decimal deg to minutes and seconds
        const d = Math.floor(deg);
        const minfloat = (deg - d) * 60;
        const m = Math.floor(minfloat);
        const secfloat = (minfloat - m) * 60;
        const s = Math.floor(secfloat);

        return ("" + d + "° " + m + "' " + s + "'' ");
    },
    mToft(length) {
        return length * 3.28084;
    },
    mTokm(length) {
        return length * 0.001;
    },
    mTomi(length) {
        return length * 0.000621371;
    },
    sqmTosqft(area) {
        return area * 10.7639;
    },
    sqmTosqkm(area) {
        return area * 0.000001;
    },
    sqmTosqmi(area) {
        return area * 0.000000386102159;
    },
    sqmToha(area) {
        return area * 0.0001;
    }
};

export default MeasureUtils;

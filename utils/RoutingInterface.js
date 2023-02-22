/**
 * Copyright 2023 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import axios from 'axios';
import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';
import VectorLayerUtils from './VectorLayerUtils';

function decodeShape(str, precision = null) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    let shift = 0;
    let result = 0;
    let byte = null;
    let latitudeChange;
    let longitudeChange;
    const factor = Math.pow(10, precision || 6);

    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {

        // Reset shift, result, and byte
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitudeChange = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitudeChange = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitudeChange;
        lng += longitudeChange;

        coordinates.push([lng / factor, lat / factor]);
    }

    return coordinates;
}

function getValhallaParams(costing, locations, options, extraOptions) {
    const costingOptions = {};
    if (costing === 'auto') {
        costingOptions.auto = {top_speed: options.maxSpeed};
    } else if (costing === 'bus') {
        costingOptions.bus = {top_speed: options.maxSpeed};
    } else if (costing === 'bicycle') {
        costingOptions.bicycle = {cycling_speed: options.maxSpeed};
    } else if (costing === 'pedestrian') {
        costingOptions.pedestrian = {walking_speed: options.maxSpeed};
    }
    const payload = {
        costing: costing,
        costing_options: costingOptions,
        exclude_polygons: [],
        locations: locations.map(loc => ({lon: loc[0], lat: loc[1]})),
        directions_options: {units: "kilometers"},
        ...extraOptions
    };
    return {
        json: JSON.stringify(payload)
    };
}

function computeRoute(costing, locations, options, callback) {
    const extraOptions = {
        id: "valhalla_directions"
    };
    const params = getValhallaParams(costing, locations, options, extraOptions);
    const serviceUrl = ConfigUtils.getConfigProp("routingServiceUrl").replace(/\/$/, '');
    axios.get(serviceUrl + '/route', {params}).then(response => {
        if (!response.data || !response.data.trip) {
            callback(false, {errorMsgId: LocaleUtils.trmsg("routing.computefailed")});
            return;
        }
        const trip = response.data.trip;
        if (trip.status !== 0) {
            callback(false, response.data.trip.status_message);
        }
        const result = {
            legs: trip.legs.map(leg => {
                return {
                    coordinates: decodeShape(leg.shape)
                };
            }),
            summary: {
                bounds: [trip.summary.min_lon, trip.summary.min_lat, trip.summary.max_lon, trip.summary.max_lat],
                time: trip.summary.time,
                length: trip.summary.length
            }
        };
        callback(true, result);
    }).catch((e) => {
        const error = ((e.response || {}).data || {}).error;
        const data = {};
        if (error) {
            data.error = error;
        } else {
            data.errorMsgId = LocaleUtils.trmsg("routing.computefailed");
        }
        callback(false, data);
    });
}

function computeIsochrone(costing, location, contourOptions, options, callback) {
    const extraOptions = {
        contours: contourOptions.intervals.map(entry => ({[contourOptions.mode]: entry})),
        id: "valhalla_isochrone"
    };
    const params = getValhallaParams(costing, [location], options, extraOptions);
    const serviceUrl = ConfigUtils.getConfigProp("routingServiceUrl").replace(/\/$/, '');
    axios.get(serviceUrl + '/isochrone', {params}).then(response => {
        if (!response.data || !response.data.features) {
            callback(false, {errorMsgId: LocaleUtils.trmsg("routing.computefailed")});
            return;
        }
        const areas = response.data.features.map(feature => feature.geometry.coordinates);
        callback(true, {areas: areas, bounds: VectorLayerUtils.computeFeatureBBox(response.data)});
    }).catch((e) => {
        const error = ((e.response || {}).data || {}).error;
        const data = {};
        if (error) {
            data.error = error;
        } else {
            data.errorMsgId = LocaleUtils.trmsg("routing.computefailed");
        }
        callback(false, data);
    });
}

export default {
    computeRoute,
    computeIsochrone
};

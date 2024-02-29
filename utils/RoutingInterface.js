/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import axios from 'axios';
import {v1 as uuidv1} from 'uuid';

import ConfigUtils from './ConfigUtils';
import LocaleUtils from './LocaleUtils';
import VectorLayerUtils from './VectorLayerUtils';

const ValhallaSession = {
    reqId: null,
    pending: 0,
    result: null,
    clear: () => {
        ValhallaSession.reqId = null;
        ValhallaSession.pending = 0;
        ValhallaSession.result = null;
    }
};

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
        costingOptions.auto = {
            top_speed: options.maxSpeed,
            shortest: options.method === 'shortest',
            use_ferry: options.useFerries ? 1 : 0,
            use_tolls: options.useTollways ? 1 : 0,
            use_highways: options.useHighways ? 1 : 0
        };
    } else if (costing === 'heavyvehicle') {
        costing = 'truck';
        costingOptions.truck = {
            top_speed: options.maxSpeed,
            shortest: options.method === 'shortest',
            use_ferry: options.useFerries ? 1 : 0,
            use_tolls: options.useTollways ? 1 : 0,
            use_highways: options.useHighways ? 1 : 0
        };
    } else if (costing === 'transit') {
        costing = 'multimodal';
        const timepointMap = {
            now: 0,
            leaveat: 1,
            arriveat: 2
        };
        extraOptions.date_time = {
            value: options.time.slice(0, 16),
            type: timepointMap[options.timepoint]
        };
    } else if (costing === 'bicycle') {
        costingOptions.bicycle = {
            cycling_speed: options.maxSpeed,
            shortest: options.method === 'shortest',
            use_ferry: options.useFerries ? 1 : 0
        };
    } else if (costing === 'pedestrian') {
        costingOptions.pedestrian = {
            walking_speed: options.maxSpeed,
            shortest: options.method === 'shortest',
            use_ferry: options.useFerries ? 1 : 0
        };
    }
    const payload = {
        costing: costing,
        costing_options: costingOptions,
        exclude_polygons: options.exclude_polygons || [],
        locations: locations.map(loc => ({lon: loc[0], lat: loc[1]})),
        directions_options: {units: "kilometers", language: LocaleUtils.lang()},
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
    const endpoint = options.optimized_route ? 'optimized_route' : 'route';
    axios.get(serviceUrl + '/' + endpoint, {params}).then(response => {
        if (!response.data || !response.data.trip) {
            callback(false, {errorMsgId: LocaleUtils.trmsg("routing.computefailed")});
            return;
        }
        const trip = response.data.trip;
        if (trip.status !== 0) {
            callback(false, response.data.trip.status_message);
        }
        // https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
        const travelTypeMap = {
            car: {icon: "routing-car", color: [0, 0, 255, 1]},
            tractor_trailer: {icon: "routing-truck", color: [0, 0, 255, 1]},
            foot: {icon: "routing-walking", color: [127, 127, 255, 1]},
            road: {icon: "routing-bicycle", color: [0, 127, 0, 1]},
            tram: {icon: "routing-tram", color: [255, 0, 0, 1]},
            metro: {icon: "routing-tram", color: [255, 0, 0, 1]},
            rail: {icon: "routing-train", color: [255, 0, 0, 1]},
            bus: {icon: "routing-bus", color: [255, 0, 0, 1]},
            ferry: {icon: "routing-ship", color: [0, 0, 200, 1]},
            cable_car: {icon: "routing-cablecar", color: [255, 0, 0, 1]},
            gondola: {icon: "routing-cablecar", color: [255, 0, 0, 1]},
            funicular: {icon: "routing-cablecar", color: [255, 0, 0, 1]}
        };
        const result = {
            legs: trip.legs.map(leg => {
                return {
                    coordinates: decodeShape(leg.shape),
                    time: leg.summary.time,
                    length: leg.summary.length * 1000,
                    maneuvers: leg.maneuvers.map(entry => ({
                        instruction: entry.instruction,
                        post_instruction: entry.verbal_post_transition_instruction,
                        geom_indices: [entry.begin_shape_index, entry.end_shape_index],
                        icon: (travelTypeMap[entry.travel_type] || {}).icon || "routing",
                        color: (travelTypeMap[entry.travel_type] || {}).color || "#0000FF",
                        time: entry.time,
                        length: entry.length * 1000
                    }))
                };
            }),
            locations: trip.locations.map(location => ({
                lat: location.lat,
                lon: location.lon,
                orig_idx: location.original_index
            })),
            summary: {
                bounds: [trip.summary.min_lon, trip.summary.min_lat, trip.summary.max_lon, trip.summary.max_lat],
                time: trip.summary.time,
                length: trip.summary.length * 1000
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

function computeIsochrone(costing, locations, contourOptions, options, callback) {
    const extraOptions = {
        contours: contourOptions.intervals.map(entry => ({[contourOptions.mode]: entry})),
        id: "valhalla_isochrone"
    };
    const serviceUrl = ConfigUtils.getConfigProp("routingServiceUrl").replace(/\/$/, '');
    const reqId = uuidv1();
    ValhallaSession.reqId = reqId;
    ValhallaSession.pending = locations.length;
    locations.forEach(location => {
        const params = getValhallaParams(costing, [location], options, extraOptions);

        axios.get(serviceUrl + '/isochrone', {params}).then(response => {
            if (reqId !== ValhallaSession.reqId) {
                return;
            }
            if (!response.data || !response.data.features) {
                ValhallaSession.clear();
                callback(false, {errorMsgId: LocaleUtils.trmsg("routing.computefailed")});
                return;
            }
            ValhallaSession.pending -= 1;
            if (!ValhallaSession.result) {
                ValhallaSession.result = response.data;
            } else {
                ValhallaSession.result.features.push(...response.data.features);
            }
            if (ValhallaSession.pending === 0) {
                const areas = ValhallaSession.result.features.map(feature => feature.geometry.coordinates);
                callback(true, {areas: areas, bounds: VectorLayerUtils.computeFeatureBBox(ValhallaSession.result)});
                ValhallaSession.clear();
            }
        }).catch((e) => {
            ValhallaSession.clear();
            const error = ((e.response || {}).data || {}).error;
            const data = {};
            if (error) {
                data.error = error;
            } else {
                data.errorMsgId = LocaleUtils.trmsg("routing.computefailed");
            }
            callback(false, data);
        });
    });
}

export default {
    computeRoute,
    computeIsochrone
};

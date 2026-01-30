/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_MEASUREMENT_STATE} from '../actions/measurement';

const defaultState = {
    mode: null,
    drawing: false,
    coordinates: null,
    length: null,
    area: 0,
    bearing: 0,
    lenUnit: 'metric',
    areaUnit: 'metric',
    bearingHeadMarker: null,
    bearingTailMarker: null,
    lineHeadMarker: null,
    lineTailMarker: null,
    showPerimeterLength: false,
    markerScale: 1
};

export default function measurement(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_MEASUREMENT_STATE: {
        const prevState = state.mode === (action.data.mode ?? state.mode) ? state : {};
        return {
            ...prevState,
            lenUnit: state.lenUnit,
            areaUnit: state.areaUnit,
            bearingHeadMarker: state.bearingHeadMarker,
            bearingTailMarker: state.bearingTailMarker,
            lineHeadMarker: state.lineHeadMarker,
            lineTailMarker: state.lineTailMarker,
            showPerimeterLength: state.showPerimeterLength,
            markerScale: state.markerScale,
            ...action.data
        };
    }
    default:
        return state;
    }
}

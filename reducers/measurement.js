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
    geomType: null,
    coordinates: null,
    length: null,
    area: 0,
    bearing: 0,
    lenUnit: 'metric',
    areaUnit: 'metric',
    decimals: 2
};

export default function measurement(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_MEASUREMENT_STATE: {
        return {lenUnit: state.lenUnit, areaUnit: state.areaUnit, ...action.data};
    }
    default:
        return state;
    }
}

/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import measurementReducer from '../reducers/measurement';
ReducerIndex.register("measurement", measurementReducer);

export const CHANGE_MEASUREMENT_STATE = 'CHANGE_MEASUREMENT_STATE';

export function changeMeasurementState(measureState) {
    return {
        type: CHANGE_MEASUREMENT_STATE,
        data: measureState
    };
}

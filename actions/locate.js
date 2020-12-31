/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import locateReducer from '../reducers/locate';
ReducerRegistry.register("locate", locateReducer);

export const CHANGE_LOCATE_STATE = 'CHANGE_LOCATE_STATE';
export const LOCATE_ERROR = 'LOCATE_ERROR';

export function changeLocateState(state) {
    return {
        type: CHANGE_LOCATE_STATE,
        state: state
    };
}

export function onLocateError(error) {
    return {
        type: LOCATE_ERROR,
        error: error
    };
}

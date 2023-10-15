/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import locateReducer from '../reducers/locate';
ReducerIndex.register("locate", locateReducer);

export const CHANGE_LOCATE_STATE = 'CHANGE_LOCATE_STATE';
export const CHANGE_LOCATE_POSITION = 'CHANGE_LOCATE_POSITION';
export const LOCATE_ERROR = 'LOCATE_ERROR';


/**
 * Change locate state.
 * 
 * @param {string} state - The new state.
 * 
 * @memberof Redux Store.Actions
 */
export function changeLocateState(state) {
    return {
        type: CHANGE_LOCATE_STATE,
        state
    };
}

/**
 * Change locate position.
 *
 * @param {object} position - The new position.
 *
 * @memberof Redux Store.Actions
 */
export function changeLocatePosition(position) {
    return {
        type: CHANGE_LOCATE_POSITION,
        position: position
    };
}

export function onLocateError(error) {
    return {
        type: LOCATE_ERROR,
        error: error
    };
}

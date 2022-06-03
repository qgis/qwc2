/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_EDITING_STATE} from '../actions/editing';

const defaultState = {
    action: null,
    geomType: null,
    feature: null,
    changed: false,
    geomReadOnly: false
};

const nonZeroZCoordinate = (coordinates) => {
    return coordinates.find(entry => Array.isArray(entry[0]) ? nonZeroZCoordinate(entry) : entry.length >= 3 && entry[2] !== 0);
};

export default function editing(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_EDITING_STATE: {
        const changed = action.data.feature !== null && action.data.changed === true;
        let geomReadOnly = state.geomReadOnly;
        if (!action.data.feature) {
            geomReadOnly = false;
        } else if (action.data.feature && action.data.feature.id !== (state.feature || {}).id) {
            geomReadOnly = nonZeroZCoordinate((action.data.feature.geometry || {}).coordinates || []);
        }
        return {...state, ...action.data, changed: changed, geomReadOnly: geomReadOnly};
    }
    default:
        return state;
    }
}

/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_REDLINING_STATE} from '../actions/redlining';

const defaultState = {
    action: null,
    geomType: null,
    style: {
        borderColor: [255, 0, 0, 1],
        size: 2,
        fillColor: [255, 255, 255, 1],
        text: ""
    },
    layer: 'redlining',
    layerTitle: 'Redlining',
    selectedFeature: null,
    drawMultiple: true,
    measurements: false,
    numericInput: false,
    lenUnit: 'metric',
    areaUnit: 'metric'
};

export default function redlining(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_REDLINING_STATE: {
        return {...state, ...action.data};
    }
    default:
        return state;
    }
}

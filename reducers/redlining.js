/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_REDLINING_STATE, RESET_REDLINING_STATE} from '../actions/redlining';

const defaultState = {
    action: null,
    geomType: null,
    format: null,
    style: {
        borderColor: [255, 0, 0, 1],
        fillColor: [255, 255, 255, 1],
        strokeDash: [],
        size: 2,
        text: "",
        textOutlineColor: [255, 255, 255, 1],
        textFillColor: [0, 0, 0, 1]
    },
    layer: null,
    layerTitle: null,
    selectedFeature: null,
    drawMultiple: true,
    freehand: false,
    measurements: false,
    extraAction: null,
    lenUnit: 'metric',
    areaUnit: 'metric'
};

export default function redlining(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_REDLINING_STATE: {
        const newstate = {...state, ...action.data};
        if (action.data.style) {
            newstate.style = {...state.style, ...action.data.style};
        }
        return newstate;
    }
    case RESET_REDLINING_STATE: {
        return defaultState;
    }
    default:
        return state;
    }
}

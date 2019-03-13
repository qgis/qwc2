/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
    CHANGE_REDLINING_STATE
} = require('../actions/redlining');

const assign = require('object-assign');

function redlining(state = {
    action: null,
    geomType: null,
    style: {
        borderColor: [255, 0, 0, 1],
        size: 2,
        fillColor:  [255, 255, 255, 1],
        text: "",
    },
    layer: 'redlining',
    layerTitle: 'Redlining',
    selectedFeature: null
}, action) {
    switch (action.type) {
        case CHANGE_REDLINING_STATE:
            return assign({}, state, action.data);
        default:
            return state;
    }
}

module.exports = redlining;

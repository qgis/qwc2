/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var {
    CHANGE_SELECTION_STATE
} = require('../actions/selection');

const assign = require('object-assign');

function selection(state = {
    geomType: null,
    style: 'default',
    reset: false
}, action) {
    switch (action.type) {
        case CHANGE_SELECTION_STATE:
            return assign({}, state, {
                geomType: action.geomType,
                point: action.point,
                line: action.line,
                polygon: action.polygon,
                style: action.style,
                reset: action.reset
            });
        default:
            return state;
    }
}

module.exports = selection;

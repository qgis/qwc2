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
    borderColor: "#FF0000",
    size: 2,
    fillColor: "#FFFFFF",
    text: ""
}, action) {
    switch (action.type) {
        case CHANGE_REDLINING_STATE:
            return assign({}, state, action.data);
        default:
            return state;
    }
}

module.exports = redlining;

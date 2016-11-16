/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TOGGLE_FULLSCREEN} = require('../actions/display');
const assign = require('object-assign');

function toggleFullscreen(state = {fullscreen: false}, action) {
    switch (action.type) {
        case TOGGLE_FULLSCREEN:
            return assign({}, state, {
                fullscreen: action.fullscreen
            });
        default:
            return state;
    }
}

module.exports = toggleFullscreen;

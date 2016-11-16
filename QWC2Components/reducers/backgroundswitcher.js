/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TOGGLE_BACKGROUNDSWITCHER} = require('../actions/backgroundswitcher');
const assign = require('object-assign');

function toggleBackgroundswitcher(state = {visible: false}, action) {
    switch (action.type) {
        case TOGGLE_BACKGROUNDSWITCHER:
            return assign({}, state, {
                visible: action.visible
            });
        default:
            return state;
    }
}

module.exports = toggleBackgroundswitcher;

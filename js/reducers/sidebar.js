/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {SET_CURRENT_SIDEBAR} = require('../actions/sidebar');
const assign = require('object-assign');


function sidebar(state = {}, action)
{
    switch (action.type) {
        case SET_CURRENT_SIDEBAR:
            return assign({}, state, {current: action.current});
        default:
            return state;
    }
}

module.exports = sidebar;

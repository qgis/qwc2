/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {SET_CURRENT_TASK} = require('../actions/task');
const assign = require('object-assign');


function task(state = {}, action)
{
    switch (action.type) {
        case SET_CURRENT_TASK:
            return assign({}, state, {current: action.current, mode: action.mode});
        default:
            return state;
    }
}

module.exports = task;

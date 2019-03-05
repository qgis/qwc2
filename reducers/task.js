/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {SET_CURRENT_TASK, SET_CURRENT_TASK_BLOCKED} = require('../actions/task');
const assign = require('object-assign');


function task(state = {}, action)
{
    switch (action.type) {
        case SET_CURRENT_TASK:
            if(state.blocked) {
                return state;
            }
            return assign({}, state, {id: action.id, mode: action.mode});
        case SET_CURRENT_TASK_BLOCKED:
            return assign({}, state, {blocked: action.blocked});
        default:
            return state;
    }
}

module.exports = task;

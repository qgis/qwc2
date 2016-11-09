/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SET_CURRENT_TASK = 'SET_CURRENT_TASK';

function setCurrentTask(task) {
    return {
        type: SET_CURRENT_TASK,
        current: task
    };
}

module.exports = {
    SET_CURRENT_TASK,
    setCurrentTask
}

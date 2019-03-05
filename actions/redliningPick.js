/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const CHANGE_REDLINING_PICK_STATE = 'CHANGE_REDLINING_PICK_STATE';

function changeRedliningPickState(data) {
    return {
        type: CHANGE_REDLINING_PICK_STATE,
        data: data
    };
}

module.exports = {
    CHANGE_REDLINING_PICK_STATE,
    changeRedliningPickState
};

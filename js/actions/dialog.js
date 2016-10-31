/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const CHANGE_DIALOG_STATE = 'CHANGE_DIALOG_STATE';

function changeDialogState(statechange) {
    return {
        type: CHANGE_DIALOG_STATE,
        statechange: statechange
    }
}

module.exports = {
    CHANGE_DIALOG_STATE,
    changeDialogState
}

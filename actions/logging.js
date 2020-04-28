/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const LOG_ACTION = 'LOG_ACTION';

function logAction(actionType, data) {
    return {
        type: LOG_ACTION,
        actionType: actionType,
        data: data
    };
}

module.exports = {
    LOG_ACTION,
    logAction
};

/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const LOG_ACTION = 'LOG_ACTION';


/**
 * Log an action.
 * 
 * @param {string} actionType - The type of the action.
 * @param {object} data - The data of the action.
 * 
 * TODO: This is not used anywhere.
 * 
 * @memberof Redux Store.Actions
 */
export function logAction(actionType, data) {
    return {
        type: LOG_ACTION,
        actionType: actionType,
        data: data
    };
}

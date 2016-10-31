/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_DIALOG_STATE} = require('../actions/dialog');
const assign = require('object-assign');


function dialog(state = {}, action)
{
    switch (action.type) {
        case CHANGE_DIALOG_STATE:
            return assign({}, state, action.statechange);
        default:
            return state;
    }
}

module.exports = dialog;

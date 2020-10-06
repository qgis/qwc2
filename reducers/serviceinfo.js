/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const assign = require('object-assign');
const {SET_ACTIVE_SERVICEINFO} = require('../actions/serviceinfo');

function serviceInfo(state = {}, action) {
    switch (action.type) {
        case SET_ACTIVE_SERVICEINFO:
            return assign({}, state, {service: action.service});
        default:
            return state;
    }
}

module.exports = serviceInfo;

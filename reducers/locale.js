/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_LOCALE} = require('../actions/locale');
const flatten = require('flat');

function locale(state = {
    messages: {},
    current: ''
}, action) {
    switch (action.type) {
    case CHANGE_LOCALE:
        return {
            messages: flatten(action.messages),
            current: action.locale
        };
    default:
        return state;
    }
}

module.exports = locale;

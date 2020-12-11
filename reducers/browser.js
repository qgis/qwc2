/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_BROWSER_PROPERTIES} = require('../actions/browser');
const assign = require('object-assign');

function browser(state = null, action) {
    switch (action.type) {
    case CHANGE_BROWSER_PROPERTIES: {
        return assign({}, state, action.newProperties);
    }
    default:
        return state;
    }
}

module.exports = browser;

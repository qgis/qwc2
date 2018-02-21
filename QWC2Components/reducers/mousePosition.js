/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const assign = require('object-assign');
const {CHANGE_MOUSE_POSITION_STATE} = require('../actions/mousePosition');

function mousePosition(state = {enabled: true}, action) {
    switch (action.type) {
        case CHANGE_MOUSE_POSITION_STATE:
            return assign({}, state, action.data);
        default:
            return state;
    }
}

module.exports = mousePosition;

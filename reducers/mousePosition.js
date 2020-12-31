/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assign from 'object-assign';
import {CHANGE_MOUSE_POSITION_STATE} from '../actions/mousePosition';

const defaultState = {
    enabled: true
};

export default function mousePosition(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_MOUSE_POSITION_STATE: {
        return assign({}, state, action.data);
    }
    default:
        return state;
    }
}

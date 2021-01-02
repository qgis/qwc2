/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {LOCAL_CONFIG_LOADED, SET_STARTUP_PARAMETERS} from '../actions/localConfig';

import assign from 'object-assign';
import ConfigUtils from '../utils/ConfigUtils';

const defaultState = {
    ...ConfigUtils.getDefaults(),
    startupParams: {}
};

export default function localConfig(state = defaultState, action) {
    switch (action.type) {
    case LOCAL_CONFIG_LOADED: {
        return assign({}, state, action.config);
    }
    case SET_STARTUP_PARAMETERS: {
        return assign({}, state, {startupParams: action.params});
    }
    default:
        return state;
    }
}

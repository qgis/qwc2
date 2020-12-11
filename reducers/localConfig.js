/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {LOCAL_CONFIG_LOADED, SET_STARTUP_PARAMETERS} = require('../actions/localConfig');

const assign = require('object-assign');
const ConfigUtils = require('../utils/ConfigUtils');

const defaultState = ConfigUtils.getDefaults();

function localConfig(state = defaultState, action) {
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

module.exports = localConfig;

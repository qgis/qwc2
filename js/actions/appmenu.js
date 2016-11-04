/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_MEASUREMENT_TOOL} = require('../../MapStore2/web/client/actions/measurement');
const {SET_CURRENT_SIDEBAR} = require('./sidebar');
const {CHANGE_DIALOG_STATE} = require('./dialog');

function triggerAppMenuitem(key) {
    if(key === 'measure') {
        return {
            type: CHANGE_MEASUREMENT_TOOL,
            geomType: 'LineString'
        };
    } else if(key === 'themes') {
        return {
            type: SET_CURRENT_SIDEBAR,
            current: 'themeswitcher'
        }
    } else if(key === 'share') {
        return {
            type: SET_CURRENT_SIDEBAR,
            current: 'Share'
        }
    } else if(key === 'print') {
        return {
            type: SET_CURRENT_SIDEBAR,
            current: 'print'
        }
    }
    return (dispatch) => {};
}

module.exports = {
    triggerAppMenuitem
}

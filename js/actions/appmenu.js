/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_MEASUREMENT_TOOL} = require('../../MapStore2/web/client/actions/measurement');
const {SET_CONTROL_PROPERTY} = require('../../MapStore2/web/client/actions/controls');
const {SET_CURRENT_TASK} = require('./task');
const {CHANGE_DIALOG_STATE} = require('./dialog');

function triggerAppMenuitem(key) {
    if(key === 'measure') {
        return {
            type: CHANGE_MEASUREMENT_TOOL,
            geomType: 'LineString'
        };
    } else if(key === 'themes') {
        return {
            type: SET_CURRENT_TASK,
            current: 'ThemeSwitcher'
        }
    } else if(key === 'share') {
        return {
            type: SET_CURRENT_TASK,
            current: 'Share'
        }
    } else if(key === 'print') {
        return {
            type: SET_CURRENT_TASK,
            current: 'Print'
        }
    } else if(key === 'dxfexport') {
        return {
            type: SET_CURRENT_TASK,
            current: 'dxfexport'
        }
    }
    return (dispatch) => {};
}

module.exports = {
    triggerAppMenuitem
}

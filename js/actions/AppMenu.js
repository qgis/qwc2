/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {CHANGE_MEASUREMENT_TOOL} = require('../../MapStore2/web/client/actions/measurement');
const {SET_THEME_SWITCHER_VISIBILITY} = require('./theme');
const {CHANGE_DIALOG_STATE} = require('./dialog');

function triggerAppMenuitem(key) {
    if(key === 'measure') {
        return {
            type: CHANGE_MEASUREMENT_TOOL,
            geomType: 'LineString'
        };
    } else if(key === 'themes') {
        return {
            type: SET_THEME_SWITCHER_VISIBILITY,
            visible: true
        }
    } else if(key === 'link') {
        return {
            type: CHANGE_DIALOG_STATE,
            statechange: {share: true}
        }
    }
    return (dispatch) => {};
}

module.exports = {
    triggerAppMenuitem
}

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {changeMeasurement} = require('../../MapStore2/web/client/actions/measurement');
const {setCurrentTask} = require('./task');

function triggerAppMenuitem(key) {
    if(key === 'measure') {
        return (dispatch => {
            dispatch(setCurrentTask('Measure'));
            dispatch(changeMeasurement({geomType: 'Point'}));
        });
    } else if(key === 'themes') {
        return setCurrentTask('ThemeSwitcher');
    } else if(key === 'share') {
        return setCurrentTask('Share');
    } else if(key === 'print') {
        return setCurrentTask('Print');
    } else if(key === 'dxfexport') {
        return setCurrentTask('dxfexport');
    }
    return (dispatch) => {};
}

module.exports = {
    triggerAppMenuitem
}

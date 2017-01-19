/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {changeMeasurement} = require('../../MapStore2/web/client/actions/measurement');
const {changeDrawingStatus} = require('../../MapStore2/web/client/actions/draw');
const {setCurrentTask} = require('./task');

function triggerTool(key) {
    if(key === 'Measure') {
        return (dispatch => {
            dispatch(setCurrentTask('Measure'));
            dispatch(changeMeasurement({geomType: 'Point'}));
        });
    } else if(key === 'Draw') {
        return (dispatch => {
            dispatch(setCurrentTask('Draw'));
            dispatch(changeDrawingStatus('create'));
        });
    } else {
        return setCurrentTask(key);
    }
    return (dispatch) => {};
}

module.exports = {
    triggerTool
}

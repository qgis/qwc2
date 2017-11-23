/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {changeMeasurement} = require('../../MapStore2Components/actions/measurement');
const {changeRedliningState} = require('./redlining');
const {changeDrawingStatus} = require('../../MapStore2Components/actions/draw');
const {setCurrentTask} = require('./task');

function triggerTool(key, mode=null) {
    if(key === 'Measure') {
        return (dispatch => {
            dispatch(setCurrentTask('Measure', mode));
            dispatch(changeMeasurement({geomType: mode || 'Point'}));
        });
    } else if(key === 'Redlining') {
        return (dispatch => {
            dispatch(setCurrentTask('Redlining', mode));
            dispatch(changeRedliningState({action: 'Pick'}));
        });
    } else if(key === 'Draw') {
        return (dispatch => {
            dispatch(setCurrentTask('Draw', mode));
            dispatch(changeDrawingStatus('create'));
        });
    } else if(key == 'LayerTree') {
        return setCurrentTask('LayerTree', null, true);
    } else {
        return setCurrentTask(key, mode);
    }
    return (dispatch) => {};
}

module.exports = {
    triggerTool
}

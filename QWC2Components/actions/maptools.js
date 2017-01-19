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

    if(key === 'measure') {
function triggerTool(key) {
        return (dispatch => {
            dispatch(setCurrentTask('Measure'));
            dispatch(changeMeasurement({geomType: 'Point'}));
        });
    } else if(key === 'draw') {
        return (dispatch => {
            dispatch(setCurrentTask('Draw'));
            dispatch(changeDrawingStatus('create'));
        });
    } else if(key === 'themes') {
        return setCurrentTask('ThemeSwitcher');
    } else if(key === 'layers') {
        return setCurrentTask('LayerTree');
    } else if(key === 'share') {
        return setCurrentTask('Share');
    } else if(key === 'print') {
        return setCurrentTask('Print');
    } else if(key === 'dxfexport') {
        return setCurrentTask('dxfexport');
    } else if(key === 'help') {
        return setCurrentTask('Help');
    }
    return (dispatch) => {};
}

module.exports = {
    triggerTool
}

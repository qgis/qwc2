/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import identifyReducer from '../reducers/identify';
import ReducerIndex from '../reducers/index';
ReducerIndex.register("identify", identifyReducer);

import ConfigUtils from '../utils/ConfigUtils';

export const SET_IDENTIFY_TOOL = 'SET_IDENTIFY_TOOL';

export function setIdentifyEnabled(enabled, theme = null) {
    return (dispatch, getState) => {
        let identifyTool = ConfigUtils.getConfigProp("identifyTool", theme || getState().theme.current);
        identifyTool = identifyTool !== undefined ? identifyTool : "Identify";
        dispatch({
            type: SET_IDENTIFY_TOOL,
            tool: enabled ? identifyTool : null
        });
    };
}

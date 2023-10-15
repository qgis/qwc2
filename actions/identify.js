/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import identifyReducer from '../reducers/identify';
ReducerIndex.register("identify", identifyReducer);

import ConfigUtils from '../utils/ConfigUtils';

export const SET_IDENTIFY_TOOL = 'SET_IDENTIFY_TOOL';


/**
 * Sets the current identify tool.
 * 
 * The function will use the `identifyTool` property from the
 * `theme` argument or from current theme if `theme` is not specified.
 * 
 * If the theme does not specify an `identifyTool` property,
 * the default `Identify` is used.
 * 
 * If the `enabled` argument is `false`, the current tool is set to `null`.
 * 
 * @param {boolean} enabled - whether identify tool is enabled.
 * @param {string} theme - optional theme name to use for identify tool.
 * 
 * @memberof Redux Store.Actions
 */
export function setIdentifyEnabled(enabled, theme = null) {
    return (dispatch, getState) => {
        let identifyTool = ConfigUtils.getConfigProp(
            "identifyTool", theme || getState().theme.current
        );
        identifyTool = identifyTool !== undefined
            ? identifyTool
            : "Identify";
        dispatch({
            type: SET_IDENTIFY_TOOL,
            tool: enabled ? identifyTool : null
        });
    };
}

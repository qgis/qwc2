/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import browserReducer from '../reducers/browser';
ReducerIndex.register("browser", browserReducer);

export const CHANGE_BROWSER_PROPERTIES = 'CHANGE_BROWSER_PROPERTIES';

/**
 * Update browser properties.
 * 
 * @param {object} properties - information retrieved by 
 *      {@link ConfigUtils.getBrowserProperties}.
 * @memberof Redux Store.Actions
 */
export function changeBrowserProperties(properties) {
    return {
        type: CHANGE_BROWSER_PROPERTIES,
        newProperties: properties
    };
}

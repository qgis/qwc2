/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import browserReducer from '../reducers/browser';
import ReducerIndex from '../reducers/index';
ReducerIndex.register("browser", browserReducer);

export const CHANGE_BROWSER_PROPERTIES = 'CHANGE_BROWSER_PROPERTIES';


export function changeBrowserProperties(properties) {
    return {
        type: CHANGE_BROWSER_PROPERTIES,
        newProperties: properties
    };
}

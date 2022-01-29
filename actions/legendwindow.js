/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import legendwindowReducer from '../reducers/legendwindow';
ReducerIndex.register("legendwindow", legendwindowReducer);

export const SET_VISIBLE_LEGENDWINDOW = 'SET_VISIBLE_LEGENDWINDOW';

export function setVisibleLegendWindow(layers, visible) {
    return {
        type: SET_VISIBLE_LEGENDWINDOW,
        layers: layers,
        visible: visible
    };
}

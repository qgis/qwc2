/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import displayReducer from '../reducers/display';
import ReducerIndex from '../reducers/index';
ReducerIndex.register("display", displayReducer);

export const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';

export function toggleFullscreen(fullscreen) {
    if (fullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
    return {
        type: TOGGLE_FULLSCREEN,
        fullscreen: fullscreen
    };
}

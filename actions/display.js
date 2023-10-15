/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import displayReducer from '../reducers/display';
ReducerIndex.register("display", displayReducer);

export const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';

/**
 * Issues a request to the browser to
 * enter full screen mode.
 */
export function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullScreen) {
        document.documentElement.webkitRequestFullScreen();
    }
}

/**
 * Issues a request to the browser to
 * exit full screen mode.
 */
export function endFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
}


/**
 * Change full screen mode.
 * 
 * @param {boolean} fullscreen - true to enter full
 *  screen mode, false to exit it.
 * @memberof Redux Store.Actions
 */
export function toggleFullscreen(fullscreen) {
    if (fullscreen) {
        requestFullscreen();
    } else {
        endFullscreen();
    }
    return {
        type: TOGGLE_FULLSCREEN,
        fullscreen: fullscreen
    };
}

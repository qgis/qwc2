/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import displayReducer from '../reducers/display';
ReducerRegistry.register("display", displayReducer);

export const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';

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

export function endFullscreen() {
    if (window.fullScreen) {
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
}

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

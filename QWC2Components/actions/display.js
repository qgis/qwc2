/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';

function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if(document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullScreen) {
        document.documentElement.webkitRequestFullScreen();
    }
}

function endFullscreen() {
    if(document.exitFullscreen) {
        document.exitFullscreen();
    } else if(document.msExitFullscreen) {
        document.msExitFullscreen();
    } else if(document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if(document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
}

function toggleFullscreen(fullscreen) {
    if(fullscreen) {
        requestFullscreen();
    } else {
        endFullscreen();
    }
    return {
        type: TOGGLE_FULLSCREEN,
        fullscreen: fullscreen
    };
}

module.exports = {
    TOGGLE_FULLSCREEN,
    toggleFullscreen
}

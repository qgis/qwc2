/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN';


function toggleFullscreen(fullscreen) {
    return {
        type: TOGGLE_FULLSCREEN,
        fullscreen: fullscreen
    };
}

module.exports = {
    TOGGLE_FULLSCREEN,
    toggleFullscreen
}

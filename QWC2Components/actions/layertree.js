/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const TOGGLE_MAPTIPS = 'TOGGLE_MAPTIPS';

function toggleMapTips(active) {
    return {
        type: TOGGLE_MAPTIPS,
        active: active
    }
}

module.exports = {
    TOGGLE_MAPTIPS,
    toggleMapTips
 }

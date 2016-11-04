/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SET_CURRENT_SIDEBAR = 'SET_CURRENT_SIDEBAR';

function setCurrentSidebar(sidebar) {
    return {
        type: SET_CURRENT_SIDEBAR,
        current: sidebar
    };
}

module.exports = {
    SET_CURRENT_SIDEBAR,
    setCurrentSidebar
}

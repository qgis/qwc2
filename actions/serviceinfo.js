/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SET_ACTIVE_SERVICEINFO = 'SET_ACTIVE_SERVICEINFO';

function setActiveServiceInfo(service) {
    return {
        type: SET_ACTIVE_SERVICEINFO,
        service: service
    };
}

module.exports = {
    SET_ACTIVE_SERVICEINFO,
    setActiveServiceInfo
};

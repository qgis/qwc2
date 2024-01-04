/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import serviceinfoReducer from '../reducers/serviceinfo';
ReducerIndex.register("serviceinfo", serviceinfoReducer);

export const SET_ACTIVE_SERVICEINFO = 'SET_ACTIVE_SERVICEINFO';

export function setActiveServiceInfo(service) {
    return {
        type: SET_ACTIVE_SERVICEINFO,
        service: service
    };
}

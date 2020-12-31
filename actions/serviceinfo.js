/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ReducerRegistry} from '../stores/StandardStore';
import serviceinfoReducer from '../reducers/serviceinfo';
ReducerRegistry.register("serviceinfo", serviceinfoReducer);

export const SET_ACTIVE_SERVICEINFO = 'SET_ACTIVE_SERVICEINFO';

export function setActiveServiceInfo(service) {
    return {
        type: SET_ACTIVE_SERVICEINFO,
        service: service
    };
}

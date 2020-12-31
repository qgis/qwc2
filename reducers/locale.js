/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CHANGE_LOCALE} from '../actions/locale';
import flatten from 'flat';

const defaultState = {
    messages: {},
    current: ''
};

export default function locale(state = defaultState, action) {
    switch (action.type) {
    case CHANGE_LOCALE: {
        return {
            messages: flatten(action.messages),
            current: action.locale
        };
    }
    default:
        return state;
    }
}

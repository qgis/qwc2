/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CHANGE_LOCALE } from '../actions/locale';
import flatten from 'flat';


/**
 * @typedef {object} LocaleState
 * @property {Record<string, string>} messages - the current locale messages
 * @property {string} current - the identifier for current locale
 */


/**
 * @type {LocaleState}
 * @private
 */
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

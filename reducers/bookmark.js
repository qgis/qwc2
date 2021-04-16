/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 import {SET_ACTIVE_USER} from '../actions/bookmark';

 const defaultState = {};
 
 export default function permalink(state = defaultState, action) {
     switch (action.type) {
     case SET_ACTIVE_USER: {
         return {...state, user: action.user};
     }
     default:
         return state;
     }
 }
 
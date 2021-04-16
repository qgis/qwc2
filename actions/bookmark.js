/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 import ReducerIndex from '../reducers/index';
 import bookmarkReducer from '../reducers/bookmark';
 ReducerIndex.register("bookmark", bookmarkReducer);
 
 export const SET_ACTIVE_USER = 'SET_ACTIVE_USER';
 
 export function setActiveUser(user) {
     return {
         type: SET_ACTIVE_USER,
         user: user
     };
 }
 
/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const TOGGLE_BACKGROUNDSWITCHER = 'TOGGLE_BACKGROUNDSWITCHER';


 function toggleBackgroundswitcher(visible) {
     return {
         type: TOGGLE_BACKGROUNDSWITCHER,
         visible: visible
     };
 }

 module.exports = {
     TOGGLE_BACKGROUNDSWITCHER,
     toggleBackgroundswitcher
  }

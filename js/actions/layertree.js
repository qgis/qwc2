/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const TOGGLE_LAYERTREE = 'TOGGLE_LAYERTREE';


function toggleLayertree(expanded) {
    return {
        type: TOGGLE_LAYERTREE,
        expanded: expanded
    };
}

module.exports = {
    TOGGLE_LAYERTREE,
    toggleLayertree
 }

/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TOGGLE_MAPTIPS} = require('../actions/layertree');
const assign = require('object-assign');

function layerTree(state = {maptips: false}, action) {
    switch (action.type) {
        case TOGGLE_MAPTIPS:
            return assign({}, state, {
                maptips: action.active
            });
        default:
            return state;
    }
}

module.exports = layerTree;

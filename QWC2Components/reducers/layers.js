/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const UrlParams = require("../utils/UrlParams");
const {
    LAYER_LOADING,
    LAYER_LOAD,
    LAYER_ERROR,
    INVALID_LAYER,
    ADD_LAYER,
    REMOVE_LAYER,
    CHANGE_LAYER_PROPERTIES
} = require('../actions/layers');


function layers(state = [], action) {
    switch (action.type) {
        case LAYER_LOADING: {
            const newLayers = (state.flat || []).map((layer) => {
                return layer.id === action.layerId ? assign({}, layer, {loading: true, loadingError: false}) : layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case LAYER_LOAD: {
            const newLayers = (state.flat || []).map((layer) => {
                return layer.id === action.layerId ? assign({}, layer, {loading: false, loadingError: action.error}) : layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case LAYER_ERROR: {
            const newLayers = (state.flat || []).map((layer) => {
                return layer.id === action.layerId ? assign({}, layer, {loading: false, loadingError: true}) : layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case INVALID_LAYER: {
            const newLayers = (state.flat||[]).map((layer) => {
                return layer.id === action.options.id ? assign({}, layer, {invalid: true}) : layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case CHANGE_LAYER_PROPERTIES: {
            let layer = state.flat.find((layer) => {return layer.id === action.layer});
            let isBackground = layer ? layer.group === 'background' : false;
            if(isBackground) {
                UrlParams.updateParams({bl: layer.name});
            }
            const newLayers = (state.flat || []).map((layer) => {
                if (layer.id === action.layer) {
                    return assign({}, layer, action.newProperties);
                } else if (layer.group === 'background' && isBackground) {
                    return assign({}, layer, {visibility: false});
                }
                return assign({}, layer);
            });
            return assign({}, state, {flat: newLayers});
        }
        case ADD_LAYER: {
            let newLayers = (state.flat || []).concat();
            let newLayer = assign({}, action.layer, {id: action.layer.id || (action.layer.name + "__" + newLayers.length)});
            newLayers.push(newLayer);
            return {flat: newLayers};
        }
        case REMOVE_LAYER: {
            let newLayers = (state.flat || []).filter(lyr => lyr.id !== action.layerId);
            return {flat: newLayers};
        }
        default:
            return state;
    }
}

module.exports = layers;

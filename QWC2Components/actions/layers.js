/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


const LAYER_LOADING = 'LAYER_LOADING';
const LAYER_LOAD = 'LAYER_LOAD';
const LAYER_ERROR = 'LAYER_ERROR';
const INVALID_LAYER = 'INVALID_LAYER';
const ADD_LAYER = 'ADD_LAYER';
const REMOVE_LAYER = 'REMOVE_LAYER';
const CHANGE_LAYER_PROPERTIES = 'CHANGE_LAYER_PROPERTIES';


function addLayer(layer, foreground = false) {
    return {
        type: ADD_LAYER,
        layer,
        foreground
    };
}

function removeLayer(layerId) {
    return {
        type: REMOVE_LAYER,
        layerId: layerId
    };
}

function changeLayerProperties(layer, properties) {
    return {
        type: CHANGE_LAYER_PROPERTIES,
        newProperties: properties,
        layer: layer

    };
}

function layerLoading(layerId) {
    return {
        type: LAYER_LOADING,
        layerId: layerId
    };
}

function layerLoad(layerId, error) {
    return {
        type: LAYER_LOAD,
        layerId,
        error
    };
}

function layerError(layerId) {
    return {
        type: LAYER_ERROR,
        layerId: layerId
    };
}

function invalidLayer(layerType, options) {
    return {
        type: INVALID_LAYER,
        layerType,
        options
    };
}


module.exports = {
    layerLoading,
    layerLoad,
    layerError,
    invalidLayer,
    addLayer,
    removeLayer,
    changeLayerProperties,
    LAYER_LOADING,
    LAYER_LOAD,
    LAYER_ERROR,
    INVALID_LAYER,
    ADD_LAYER,
    REMOVE_LAYER,
    CHANGE_LAYER_PROPERTIES
};

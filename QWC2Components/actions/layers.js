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
const ADD_LAYER_FEATURE = 'ADD_LAYER_FEATURE';
const REMOVE_LAYER_FEATURE = 'REMOVE_LAYER_FEATURE';
const ADD_LAYER_FEATURES = 'ADD_LAYER_FEATURES';
const REMOVE_LAYER_FEATURES = 'REMOVE_LAYER_FEATURES';
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

function addLayerFeature(layerId, feature) {
    return {
        type: ADD_LAYER_FEATURE,
        layerId,
        feature
    };
}

function removeLayerFeature(layerId, featureId) {
    return {
        type: REMOVE_LAYER_FEATURE,
        layerId,
        featureId
    };
}

function addLayerFeatures(layer, features, clear=false) {
    return {
        type: ADD_LAYER_FEATURES,
        layer,
        features,
        clear
    }
}

function removeLayerFeatures(layerId, featureIds) {
    return {
        type: REMOVE_LAYER_FEATURES,
        layerId,
        featureIds
    }
}

function changeLayerProperties(layerId, properties) {
    return {
        type: CHANGE_LAYER_PROPERTIES,
        newProperties: properties,
        layerId: layerId

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

function addMarker(id, point, label='', crs='EPSG:4326') {
    let layer = {
        id: "markers",
        visibility: true,
        queryable: false,
        zIndex: 100000000,
        layertreehidden: true
    }
    let feature = {
        id: id,
        geometry: {
            type: 'Point',
            coordinates: point
        },
        properties: { label: label },
        crs: crs,
        styleName: 'marker'
    };
    return addLayerFeatures(layer, [feature]);
}

function removeMarker(id) {
    return removeLayerFeatures("markers", [id]);
}

module.exports = {
    layerLoading,
    layerLoad,
    layerError,
    invalidLayer,
    addLayer,
    removeLayer,
    addLayerFeature,
    removeLayerFeature,
    addLayerFeatures,
    removeLayerFeatures,
    changeLayerProperties,
    addMarker,
    removeMarker,
    LAYER_LOADING,
    LAYER_LOAD,
    LAYER_ERROR,
    INVALID_LAYER,
    ADD_LAYER,
    REMOVE_LAYER,
    ADD_LAYER_FEATURE,
    REMOVE_LAYER_FEATURE,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    CHANGE_LAYER_PROPERTIES
};

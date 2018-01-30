/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const SET_LAYER_LOADING = 'SET_LAYER_LOADING';
const ADD_LAYER = 'ADD_LAYER';
const REMOVE_LAYER = 'REMOVE_LAYER';
const REORDER_LAYER = 'REORDER_LAYER';
const ADD_LAYER_FEATURE = 'ADD_LAYER_FEATURE';
const REMOVE_LAYER_FEATURE = 'REMOVE_LAYER_FEATURE';
const ADD_LAYER_FEATURES = 'ADD_LAYER_FEATURES';
const ADD_THEME_SUBLAYER = 'ADD_THEME_SUBLAYER';
const REMOVE_LAYER_FEATURES = 'REMOVE_LAYER_FEATURES';
const CHANGE_LAYER_PROPERTIES = 'CHANGE_LAYER_PROPERTIES';
const REFRESH_LAYER = 'REFRESH_LAYER';
const REMOVE_ALL_LAYERS = 'REMOVE_ALL_LAYERS';


const LayerRole = {
    BACKGROUND: 1,
    THEME: 2,
    USERLAYER: 3,
    SELECTION: 4,
    MARKER: 5
};


function addLayer(layer) {
    return {
        type: ADD_LAYER,
        layer
    };
}

function removeLayer(layerId) {
    return {
        type: REMOVE_LAYER,
        layerId: layerId
    };
}

function reorderLayer(layer, sublayerpath, direction, swipeActive) {
    return {
        type: REORDER_LAYER,
        layer,
        sublayerpath,
        direction,
        swipeActive
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

function addThemeSublayer(layer) {
    return {
        type: ADD_THEME_SUBLAYER,
        layer
    }
}

function changeLayerProperties(layerId, properties) {
    return {
        type: CHANGE_LAYER_PROPERTIES,
        newProperties: properties,
        layerId: layerId

    };
}

function setLayerLoading(layerId, loading) {
    return {
        type: SET_LAYER_LOADING,
        layerId: layerId,
        loading
    };
}

function addMarker(id, point, label='', crs='EPSG:4326', zIndex=null) {
    let layer = {
        id: "markers",
        role: LayerRole.MARKER,
        zIndex: zIndex
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

function refreshLayer(id) {
    return {
        type: REFRESH_LAYER,
        layerId: id
    };
}

function removeAllLayers() {
    return {
        type: REMOVE_ALL_LAYERS
    };
}

module.exports = {
    LayerRole,
    setLayerLoading,
    addLayer,
    removeLayer,
    reorderLayer,
    addLayerFeatures,
    removeLayerFeatures,
    addThemeSublayer,
    changeLayerProperties,
    addMarker,
    removeMarker,
    refreshLayer,
    removeAllLayers,
    SET_LAYER_LOADING,
    ADD_LAYER,
    REMOVE_LAYER,
    REORDER_LAYER,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    ADD_THEME_SUBLAYER,
    CHANGE_LAYER_PROPERTIES,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS
};

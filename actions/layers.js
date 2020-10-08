/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ConfigUtils = require("../utils/ConfigUtils");

const SET_LAYER_LOADING = 'SET_LAYER_LOADING';
const ADD_LAYER = 'ADD_LAYER';
const ADD_LAYER_SEPARATOR = 'ADD_LAYER_SEPARATOR';
const REMOVE_LAYER = 'REMOVE_LAYER';
const REORDER_LAYER = 'REORDER_LAYER';
const REMOVE_LAYER_FEATURE = 'REMOVE_LAYER_FEATURE';
const ADD_LAYER_FEATURES = 'ADD_LAYER_FEATURES';
const ADD_THEME_SUBLAYER = 'ADD_THEME_SUBLAYER';
const REMOVE_LAYER_FEATURES = 'REMOVE_LAYER_FEATURES';
const CHANGE_LAYER_PROPERTY = 'CHANGE_LAYER_PROPERTY';
const REFRESH_LAYER = 'REFRESH_LAYER';
const REMOVE_ALL_LAYERS = 'REMOVE_ALL_LAYERS';
const REPLACE_PLACEHOLDER_LAYER = 'REPLACE_PLACEHOLDER_LAYER';
const SET_SWIPE = 'SET_SWIPE';
const SET_LAYERS = 'SET_LAYERS';


const LayerRole = {
    BACKGROUND: 1,
    THEME: 2,
    USERLAYER: 3,
    SELECTION: 4,
    MARKER: 5
};


function addLayer(layer, pos=null, beforename=null) {
    return {
        type: ADD_LAYER,
        layer,
        pos,
        beforename
    };
}

function addLayerSeparator(title, afterLayerId, afterSublayerPath) {
    return {
        type: ADD_LAYER_SEPARATOR,
        title: title,
        afterLayerId: afterLayerId,
        afterSublayerPath: afterSublayerPath
    };
}

function removeLayer(layerId, sublayerpath=[]) {
    return {
        type: REMOVE_LAYER,
        layerId: layerId,
        sublayerpath: sublayerpath
    };
}

function reorderLayer(layer, sublayerpath, direction) {
    return (dispatch, getState) => {
        dispatch({
            type: REORDER_LAYER,
            layer,
            sublayerpath,
            direction,
            preventSplittingGroups: ConfigUtils.getConfigProp("preventSplittingGroupsWhenReordering", getState().theme.current)
        });
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

function removeLayerFeatures(layerId, featureIds, keepEmptyLayer=false) {
    return {
        type: REMOVE_LAYER_FEATURES,
        layerId,
        featureIds,
        keepEmptyLayer
    }
}

function addThemeSublayer(layer) {
    return {
        type: ADD_THEME_SUBLAYER,
        layer
    }
}

// recurseDirection: null (don't recurse), 'parents', 'children', 'both'
function changeLayerProperty(layerUuid, property, newvalue, sublayerpath=[], recurseDirection=null) {
    return {
        type: CHANGE_LAYER_PROPERTY,
        layerUuid,
        property,
        newvalue,
        sublayerpath,
        recurseDirection
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

function refreshLayer(filter) {
    return {
        type: REFRESH_LAYER,
        filter: filter
    };
}

function removeAllLayers() {
    return {
        type: REMOVE_ALL_LAYERS
    };
}

function replacePlaceholderLayer(id, layer) {
    return {
        type: REPLACE_PLACEHOLDER_LAYER,
        id,
        layer
    }
}

function setSwipe(swipe) {
    return {
        type: SET_SWIPE,
        swipe
    };
}

function setLayers(layers) {
    return {
        type: SET_LAYERS,
        layers
    };
}

module.exports = {
    LayerRole,
    setLayerLoading,
    addLayer,
    addLayerSeparator,
    removeLayer,
    reorderLayer,
    addLayerFeatures,
    removeLayerFeatures,
    addThemeSublayer,
    changeLayerProperty,
    addMarker,
    removeMarker,
    refreshLayer,
    removeAllLayers,
    replacePlaceholderLayer,
    setSwipe,
    setLayers,
    SET_LAYER_LOADING,
    ADD_LAYER,
    ADD_LAYER_SEPARATOR,
    REMOVE_LAYER,
    REORDER_LAYER,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    ADD_THEME_SUBLAYER,
    CHANGE_LAYER_PROPERTY,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS,
    REPLACE_PLACEHOLDER_LAYER,
    SET_SWIPE,
    SET_LAYERS
};

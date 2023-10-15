/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import layersReducer from '../reducers/layers';
ReducerIndex.register("layers", layersReducer);

import ConfigUtils from '../utils/ConfigUtils';

export const SET_LAYER_LOADING = 'SET_LAYER_LOADING';
export const ADD_LAYER = 'ADD_LAYER';
export const ADD_LAYER_SEPARATOR = 'ADD_LAYER_SEPARATOR';
export const REMOVE_LAYER = 'REMOVE_LAYER';
export const REORDER_LAYER = 'REORDER_LAYER';
export const ADD_LAYER_FEATURES = 'ADD_LAYER_FEATURES';
export const ADD_THEME_SUBLAYER = 'ADD_THEME_SUBLAYER';
export const REMOVE_LAYER_FEATURES = 'REMOVE_LAYER_FEATURES';
export const CLEAR_LAYER = 'CLEAR_LAYER';
export const CHANGE_LAYER_PROPERTY = 'CHANGE_LAYER_PROPERTY';
export const SET_LAYER_DIMENSIONS = 'SET_LAYER_DIMENSIONS';
export const REFRESH_LAYER = 'REFRESH_LAYER';
export const REMOVE_ALL_LAYERS = 'REMOVE_ALL_LAYERS';
export const REPLACE_PLACEHOLDER_LAYER = 'REPLACE_PLACEHOLDER_LAYER';
export const SET_SWIPE = 'SET_SWIPE';
export const SET_LAYERS = 'SET_LAYERS';

/**
 * @typedef {import('qwc2/typings').Layer} Layer
 */

/**
 * Layer role constants.
 * 
 * - `BACKGROUND`: Background layer.
 * - `THEME`: The layer belongs to a theme.
 * - `USERLAYER`: The user provided this layer manually.
 * - `SELECTION`: Selection layer.
 * - `MARKER`: Marker layer.
 * 
 * The order is important (e.g. the types below user
 * layer are hidden by default).
 */
export const LayerRole = {
    BACKGROUND: 1,
    THEME: 2,
    USERLAYER: 3,
    SELECTION: 4,
    MARKER: 5
};


/**
 * Add a layer to the map.
 * 
 * @param {Layer} layer - The layer to add.
 * @param {number|null} pos - The position to add the layer at.
 * @param {string|null} beforename - The name of the layer to
 *  insert the new layer before.
 * @memberof Redux Store.Actions
 */
export function addLayer(layer, pos = null, beforename = null) {
    return {
        type: ADD_LAYER,
        layer,
        pos,
        beforename
    };
}


/**
 * Add a layer separator to the map.
 * 
 * @param {string} title - The title of the separator.
 * @param {string|null} afterLayerId - The id of the layer to
 *  insert the separator after.
 * @param {string[]} afterSublayerPath - The sublayer path of the layer to
 *  insert the separator after.
 * @memberof Redux Store.Actions
 */
export function addLayerSeparator(title, afterLayerId, afterSublayerPath) {
    return {
        type: ADD_LAYER_SEPARATOR,
        title: title,
        afterLayerId: afterLayerId,
        afterSublayerPath: afterSublayerPath
    };
}

/**
 * Remove a layer from the map.
 * 
 * @param {string} layerId - The id of the layer to remove.
*  @param {string[]} sublayerpath - The sublayer path of the layer to remove.
 * @memberof Redux Store.Actions
 */
export function removeLayer(layerId, sublayerpath = []) {
    return {
        type: REMOVE_LAYER,
        layerId: layerId,
        sublayerpath: sublayerpath
    };
}


/**
 * Change the position of a layer in the map.
 * 
 * @param {Layer} layer - The layer to reorder.
 * @param {string[]} sublayerpath - The sublayer path of the layer to reorder.
 * @param {number} direction - The direction to move the layer in.
 * @memberof Redux Store.Actions
 */
export function reorderLayer(layer, sublayerpath, direction) {
    return (dispatch, getState) => {
        dispatch({
            type: REORDER_LAYER,
            layer,
            sublayerpath,
            direction,
            preventSplittingGroups: ConfigUtils.getConfigProp(
                "preventSplittingGroupsWhenReordering",
                getState().theme.current
            )
        });
    };
}


/**
 * Add features to a layer.
 * 
 * @param {Layer} layer - The layer to add the features to.
 * @param {object[]} features - The features to add.
 * @param {boolean} clear - Whether to clear the layer first.
 * @memberof Redux Store.Actions
 */
export function addLayerFeatures(layer, features, clear = false) {
    return {
        type: ADD_LAYER_FEATURES,
        layer,
        features,
        clear
    };
}


/**
 * Remove features from a layer.
 * 
 * @param {string} layerId - The id of the layer to remove
 *  the features from.
 * @param {string[]} featureIds - The ids of the features to remove.
 * @param {boolean} keepEmptyLayer - Whether to keep the
 *  layer if it becomes empty.
 * @memberof Redux Store.Actions
 */
export function removeLayerFeatures(
    layerId, featureIds, keepEmptyLayer = false
) {
    return {
        type: REMOVE_LAYER_FEATURES,
        layerId,
        featureIds,
        keepEmptyLayer
    };
}


/**
 * Remove all features from a layer and clear its bounding box.
 * 
 * @param {string} layerId - The id of the layer to clear.
 * @memberof Redux Store.Actions
 */
export function clearLayer(layerId) {
    return {
        type: CLEAR_LAYER,
        layerId
    };
}


/**
 * Add a sublayer to a theme layer.
 * 
 * @param {Layer} layer - The layer to add the sublayer to.
 * @memberof Redux Store.Actions
 */
export function addThemeSublayer(layer) {
    return {
        type: ADD_THEME_SUBLAYER,
        layer
    };
}

/**
 * Change a property of a layer.
 * 
 * @param {string} layerUuid - The uuid of the layer to change.
 * @param {string} property - The property to change.
 * @param {*} newvalue - The new value of the property.
 * @param {string[]} sublayerpath - The sublayer path of the layer to change.
 * @param {"parents"|"children"|"both"|null} recurseDirection - The
 *  direction to recurse in (null means don't recurse).
 * @memberof Redux Store.Actions
 */
export function changeLayerProperty(
    layerUuid, property, newvalue, sublayerpath = [], recurseDirection = null
) {
    return {
        type: CHANGE_LAYER_PROPERTY,
        layerUuid,
        property,
        newvalue,
        sublayerpath,
        recurseDirection
    };
}


/**
 * Set the dimensions of a layer.
 * 
 * @param {string} layerId - The id of the layer to change.
 * @param {{width: number, height: number}} dimensions - The new
 *  dimensions of the layer.
 * @memberof Redux Store.Actions
 */
export function setLayerDimensions(layerId, dimensions) {
    return {
        type: SET_LAYER_DIMENSIONS,
        layerId: layerId,
        dimensions: dimensions
    };
}


/**
 * Set the loading state of a layer.
 * 
 * @param {string} layerId - The id of the layer to change.
 * @param {boolean} loading - The new loading state of the layer.
 * @memberof Redux Store.Actions
 */
export function setLayerLoading(layerId, loading) {
    return {
        type: SET_LAYER_LOADING,
        layerId: layerId,
        loading
    };
}


/**
 * Add a marker layer and adds a feature to it.
 * 
 * @param {string} id - The id of the layer.
 * @param {string} point - The position.
 * @param {string} label - The label of the layer.
 * @param {string} crs - The CRS of the layer.
 * @param {number} zIndex - The z-index of the layer.
 * @memberof Redux Store.Actions
 */
export function addMarker(
    id, point, label = '', crs = 'EPSG:4326', zIndex = null
) {
    const layer = {
        id: "markers",
        role: LayerRole.MARKER,
        zIndex: zIndex
    };
    const feature = {
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


/**
 * Removes a marker feature.
 * 
 * @param {string} id - The id of the feature to remove.
 * 
 * @memberof Redux Store.Actions
 */
export function removeMarker(id) {
    return removeLayerFeatures("markers", [id]);
}


/**
 * Sets the rev(ision) to current time for all layers that pass the filter.
 * 
 * @param {(layer: any) => boolean} filter - The filter 
 *  callback that decides which layers to refresh.
 * 
 * @memberof Redux Store.Actions
 */
export function refreshLayer(filter) {
    return {
        type: REFRESH_LAYER,
        filter: filter
    };
}


/**
 * Removes all layers from the map.
 * 
 * @memberof Redux Store.Actions
 */
export function removeAllLayers() {
    return {
        type: REMOVE_ALL_LAYERS
    };
}


/**
 * Replaces a placeholder layer with a real layer.
 * 
 * @param {string} id - The id of the placeholder layer.
 * @param {Layer} layer - The layer to replace the placeholder with.
 * 
 * @memberof Redux Store.Actions
 */
export function replacePlaceholderLayer(id, layer) {
    return {
        type: REPLACE_PLACEHOLDER_LAYER,
        id,
        layer
    };
}


/**
 * Set the swipe state.
 * 
 * @param {object|null} swipe - The new swipe state.
 * 
 * @memberof Redux Store.Actions
 */
export function setSwipe(swipe) {
    return {
        type: SET_SWIPE,
        swipe
    };
}


/**
 * Set the flat list of layers.
 * 
 * @param {Layer[]} layers - The new layers.
 * 
 * @memberof Redux Store.Actions
 */
export function setLayers(layers) {
    return {
        type: SET_LAYERS,
        layers
    };
}

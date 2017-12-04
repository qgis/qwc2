/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const UrlParams = require("../utils/UrlParams");
const {isEmpty} = require('lodash');
const {
    LAYER_LOADING,
    LAYER_LOAD,
    LAYER_ERROR,
    INVALID_LAYER,
    ADD_LAYER,
    REMOVE_LAYER,
    ADD_LAYER_FEATURE,
    REMOVE_LAYER_FEATURE,
    CHANGE_LAYER_PROPERTIES,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES
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
            let layer = state.flat.find((layer) => {return layer.id === action.layerId});
            let isBackground = layer ? layer.group === 'background' : false;
            if(isBackground) {
                UrlParams.updateParams({bl: layer.name});
            }
            const newLayers = (state.flat || []).map((layer) => {
                if (layer.id === action.layerId) {
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
        case ADD_LAYER_FEATURE: {
            let newLayers = (state.flat || []).map(layer => {
                if(layer.id === action.layerId) {
                    let newFeatures = [
                        ...layer.features.filter(f => f.id !== action.feature.id),
                        action.feature];
                    return assign({}, layer, {features: newFeatures});
                }
                return layer;
            });
            return {flat: newLayers};
        }
        case REMOVE_LAYER_FEATURE: {
            let newLayers = (state.flat || []).map(layer => {
                if(layer.id === action.layerId) {
                    return assign({}, layer, {features: layer.features.filter(feature => feature.id != action.featureId)});
                }
                return layer;
            });
            return {flat: newLayers};
        }
        case ADD_LAYER_FEATURES: {
            let newLayers = (state.flat || []).concat();
            let idx = newLayers.findIndex(layer => layer.id === action.layer.id);
            if(idx == -1) {
                let newLayer = assign({}, action.layer, {type: 'vector', features: action.features});
                newLayers.push(newLayer);
            } else if(action.clear) {
                newLayers[idx] = assign({}, action.layer, {type: 'vector', features: action.features});
            } else {
                let newFeatures = [
                    ...newLayers[idx].features.filter(f => action.features.find(g => g.id === f.id) === undefined),
                    ...action.features];
                newLayers[idx] = assign({}, newLayers[idx], {features: newFeatures});
            }
            return {flat: newLayers};
        }
        case REMOVE_LAYER_FEATURES: {
            let newLayers = (state.flat || []).reduce((result, layer) => {
                if(layer.id === action.layerId) {
                    let newFeatures = layer.features.filter(f => action.featureIds.includes(f.id) === false);
                    if(!isEmpty(newFeatures)) {
                        result.push(assign({}, layer, {features: newFeatures}));
                    }
                } else {
                    result.push(layer);
                }
                return result;
            }, []);
            return {flat: newLayers};
        }
        default:
            return state;
    }
}

module.exports = layers;

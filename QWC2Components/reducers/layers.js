/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require("../utils/LayerUtils");
const {isEmpty} = require('lodash');
const uuid = require('uuid');

const {
    LAYER_LOADING,
    LAYER_LOAD,
    LAYER_ERROR,
    INVALID_LAYER,
    ADD_LAYER,
    REMOVE_LAYER,
    REORDER_LAYER,
    CHANGE_LAYER_PROPERTIES,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS
} = require('../actions/layers');


function layers(state = {}, action) {
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
                    let newLayer = assign({}, layer, action.newProperties);
                    if(newLayer.type === "wms") {
                        assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                    }
                    return newLayer;
                } else if (layer.group === 'background' && isBackground) {
                    return assign({}, layer, {visibility: false});
                }
                return layer;
            });
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case ADD_LAYER: {
            let newLayers = (state.flat || []).concat();
            let newLayer = assign({}, action.layer, {refid: uuid.v4(), uuid: uuid.v4(), id: action.layer.id || (action.layer.name + "__" + newLayers.length), priority: action.layer.priority || 0, opacity: action.layer.opacity || 255});
            let group = newLayer;
            LayerUtils.addSublayerIDs(newLayer);
            if(newLayer.type === "wms") {
                assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
            }
            let inspos = 0;
            for(; inspos < newLayers.length && newLayer.priority < newLayers[inspos].priority; ++inspos);
            newLayers.splice(inspos, 0, newLayer);
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return {flat: newLayers};
        }
        case REMOVE_LAYER: {
            let newLayers = (state.flat || []).filter(lyr => lyr.id !== action.layerId);
            return {flat: newLayers};
        }
        case ADD_LAYER_FEATURES: {
            let newLayers = (state.flat || []).concat();
            let idx = newLayers.findIndex(layer => layer.id === action.layer.id);
            if(idx == -1) {
                let inspos = 0;
                let newLayer = assign({}, action.layer, {uuid: uuid.v4(), type: 'vector', features: action.features, priority: action.layer.priority || 0, opacity: action.layer.opacity || 255});
                for(; inspos < newLayers.length && newLayer.priority < newLayers[inspos].priority; ++inspos);
                newLayers.splice(inspos, 0, newLayer);
            } else if(action.clear) {
                newLayers[idx] = assign({}, action.layer, {type: 'vector', features: action.features});
            } else {
                let addFeatures = action.features.concat();
                let newFeatures = newLayers[idx].features.map( f => {
                    let fidx = addFeatures.findIndex(g => g.id === f.id);
                    if(fidx === -1) {
                        return f;
                    } else {
                        return addFeatures.splice(fidx, 1)[0];
                    }
                })
                newFeatures = newFeatures.concat(addFeatures);
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
        case REFRESH_LAYER: {
            let newLayers = (state.flat || []).map((layer) => {
                if(layer.id === action.layerId) {
                    return assign({}, layer, {rev: (layer.rev || 0) + 1});
                }
                return layer;
            });
            return {flat: newLayers};
        }
        case REMOVE_ALL_LAYERS: {
            return {flat: []};
        }
        case REORDER_LAYER: {
            let newLayers = LayerUtils.reorderLayer(state.flat, action.layer, action.sublayerpath, action.direction, action.swipeActive);
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return {flat: newLayers};
        }
        default:
            return state;
    }
}

module.exports = layers;

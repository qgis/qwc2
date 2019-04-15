/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const {UrlParams} = require("../utils/PermaLinkUtils");
const LayerUtils = require("../utils/LayerUtils");
const isEmpty = require('lodash.isempty');
const uuid = require('uuid');

const {
    LayerRole,
    SET_LAYER_LOADING,
    ADD_LAYER,
    REMOVE_LAYER,
    REORDER_LAYER,
    CHANGE_LAYER_PROPERTIES,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    ADD_THEME_SUBLAYER,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS,
    RESTORE_LAYER_STATE,
    REPLACE_PLACEHOLDER_LAYER,
    SET_SWIPE,
    SET_LAYERS
} = require('../actions/layers');


function layers(state = {flat: [], swipe: undefined}, action) {
    switch (action.type) {
        case SET_LAYER_LOADING: {
            const newLayers = (state.flat || []).map((layer) => {
                return layer.uuid === action.layerUuid ? assign({}, layer, {loading: action.loading}) : layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case CHANGE_LAYER_PROPERTIES: {
            let layer = state.flat.find((layer) => {return layer.uuid === action.layerUuid});
            let isBackground = layer ? layer.role === LayerRole.BACKGROUND : false;
            const newLayers = (state.flat || []).map((layer) => {
                if (layer.uuid === action.layerUuid) {
                    let newLayer = assign({}, layer, action.newProperties);
                    if(newLayer.type === "wms") {
                        assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                    }
                    if(newLayer.role === LayerRole.BACKGROUND) {
                        UrlParams.updateParams({bl: newLayer.visibility ? layer.name : ''});
                    }
                    return newLayer;
                } else if (layer.role === LayerRole.BACKGROUND && isBackground) {
                    return assign({}, layer, {visibility: false});
                }
                return layer;
            });
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case ADD_LAYER: {
            let newLayers = (state.flat || []).concat();
            let newLayer = assign({}, action.layer, {
                refid: uuid.v4(),
                uuid: uuid.v4(),
                id: action.layer.id || (action.layer.name + "__" + newLayers.length),
                role: action.layer.role || LayerRole.USERLAYER,
                queryable: action.layer.queryable || false,
                visibility: action.layer.visibility !== undefined ? action.layer.visibility : true,
                opacity: action.layer.opacity || 255
            });
            newLayer = assign(newLayer, {layertreehidden: newLayer.layertreehidden || newLayer.role > LayerRole.USERLAYER});
            let group = newLayer;
            LayerUtils.addSublayerIDs(newLayer);
            if(newLayer.type === "wms") {
                assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
            }
            let inspos = 0;
            if(!action.front) {
                for(; inspos < newLayers.length && newLayer.role < newLayers[inspos].role; ++inspos);
            }
            newLayers.splice(inspos, 0, newLayer);
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            if(newLayer.role === LayerRole.BACKGROUND && newLayer.visibility) {
                UrlParams.updateParams({bl: newLayer.name});
            }
            return assign({}, state, {flat: newLayers});
        }
        case REMOVE_LAYER: {
            let layer = state.flat.find(layer => layer.id === action.layerId);
            if(!layer) {
                return state;
            }
            let newLayers = state.flat;
            if(layer.role === LayerRole.BACKGROUND || isEmpty(action.sublayerpath)) {
                newLayers = state.flat.filter(layer => layer.id !== action.layerId);
            } else {
                newLayers = LayerUtils.removeLayer(state.flat, layer, action.sublayerpath, state.swipe);
            }
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case ADD_LAYER_FEATURES: {
            let newLayers = (state.flat || []).concat();
            let idx = newLayers.findIndex(layer => layer.id === action.layer.id);
            if(idx === -1 || action.clear) {
                let newLayer = assign({}, action.layer, {
                    type: 'vector',
                    refid: uuid.v4(),
                    uuid: uuid.v4(),
                    features: action.features,
                    role: action.layer.role || LayerRole.USERLAYER,
                    queryable: action.layer.queryable || false,
                    visibility: action.layer.visibility || true,
                    opacity: action.layer.opacity || 255
                });
                newLayer = assign(newLayer, {layertreehidden: newLayer.layertreehidden || newLayer.role > LayerRole.USERLAYER});
                if(idx === -1) {
                    let inspos = 0;
                    for(; inspos < newLayers.length && newLayer.role < newLayers[inspos].role; ++inspos);
                    newLayers.splice(inspos, 0, newLayer);
                } else if(action.clear) {
                    newLayers[idx] = newLayer;
                }
            } else {
                let addFeatures = action.features.concat();
                let newFeatures = (newLayers[idx].features || []).map( f => {
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
            return assign({}, state, {flat: newLayers});
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
            return assign({}, state, {flat: newLayers});
        }
        case ADD_THEME_SUBLAYER: {
            let themeLayerIdx = state.flat.findIndex(layer => layer.role === LayerRole.THEME);
            if(themeLayerIdx >= 0) {
                let newLayers = state.flat.slice(0);
                newLayers[themeLayerIdx] = LayerUtils.mergeSubLayers(state.flat[themeLayerIdx], action.layer);
                LayerUtils.addSublayerIDs(newLayers[themeLayerIdx]);
                assign(newLayers[themeLayerIdx], LayerUtils.buildWMSLayerParams(newLayers[themeLayerIdx]));
                UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
                return assign({}, state, {flat: newLayers});
            }
            return state;
        }
        case REFRESH_LAYER: {
            let newLayers = (state.flat || []).map((layer) => {
                if(action.filter(layer)) {
                    return assign({}, layer, {rev: (layer.rev || 0) + 1});
                }
                return layer;
            });
            return assign({}, state, {flat: newLayers});
        }
        case REMOVE_ALL_LAYERS: {
            return assign({}, state, {flat: [], swipe: undefined});
        }
        case REORDER_LAYER: {
            let newLayers = LayerUtils.reorderLayer(state.flat, action.layer, action.sublayerpath, action.direction, state.swipe);
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case RESTORE_LAYER_STATE: {
            let themeLayer = (state.flat || []).find(layer => layer.role === LayerRole.THEME);
            let newLayers = (state.flat || []).filter(layer => (layer.role !== LayerRole.USERLAYER && layer.role !== LayerRole.THEME));
            for(let layer of action.layers.slice(0).reverse()) {
                if(layer.role === LayerRole.THEME) {
                    // Merge top-level fields of current theme layer
                    layer = assign({}, themeLayer, {sublayers: layer.sublayers, uuid: uuid.v4()});
                }
                newLayers.unshift(layer);
                if(layer.type === "wms") {
                    assign(layer, LayerUtils.buildWMSLayerParams(layer));
                }
            }
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case REPLACE_PLACEHOLDER_LAYER: {
            let newLayers = state.flat || [];
            if(action.layer) {
                newLayers = newLayers.map(layer => {
                    if(layer.type === 'placeholder' && layer.source === action.source) {
                        let newLayer = assign({}, action.layer, {refid: uuid.v4(), uuid: uuid.v4()});
                        LayerUtils.addSublayerIDs(newLayer);
                        if(newLayer.type === "wms") {
                            assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                        }
                        return newLayer;
                    } else {
                        return layer;
                    }
                });
            } else {
                newLayers = newLayers.filter(layer => !(layer.type === 'placeholder' && layer.source === action.source));
            }
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return assign({}, state, {flat: newLayers});
        }
        case SET_SWIPE: {
            let newLayers = state.flat;
            if( (state.swipe === undefined) !== (action.swipe === undefined) ) {
                newLayers = LayerUtils.reorderLayer(state.flat, null, null, null, action.swipe || action.swipe === 0);
            }
            return assign({}, state, {flat: newLayers, swipe: action.swipe});
        }
        case SET_LAYERS: {
            return assign({}, {flat: action.layers});
        }
        default:
            return state;
    }
}

module.exports = layers;

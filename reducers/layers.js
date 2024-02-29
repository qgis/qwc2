/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import {v4 as uuidv4} from 'uuid';

import {
    LayerRole,
    SET_LAYER_LOADING,
    ADD_LAYER,
    ADD_LAYER_SEPARATOR,
    REMOVE_LAYER,
    REORDER_LAYER,
    CHANGE_LAYER_PROPERTY,
    SET_LAYER_DIMENSIONS,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    CLEAR_LAYER,
    ADD_THEME_SUBLAYER,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS,
    REPLACE_PLACEHOLDER_LAYER,
    SET_SWIPE,
    SET_LAYERS,
    SET_FILTER
} from '../actions/layers';
import LayerUtils from '../utils/LayerUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';


function propagateLayerProperty(newlayer, property, value, path = null) {
    Object.assign(newlayer, {[property]: value});
    // Don't propagate visibility for mutually exclusive groups
    if (newlayer.sublayers && !(property === "visibility" && newlayer.mutuallyExclusive)) {
        newlayer.sublayers = newlayer.sublayers.map((sublayer, idx) => {
            if (path === null || (!isEmpty(path) && path[0] === idx)) {
                const newsublayer = {...sublayer};
                propagateLayerProperty(newsublayer, property, value, path ? path.slice(1) : null);
                return newsublayer;
            } else {
                return sublayer;
            }
        });
    }
}

const defaultState = {
    flat: [],
    loading: [],
    swipe: null
};

export default function layers(state = defaultState, action) {
    switch (action.type) {
    case SET_LAYER_LOADING: {
        const loading = state.loading.filter(layerId => layerId !== action.layerId);
        if (action.loading) {
            loading.push(action.layerId);
        }
        return {
            ...state, loading: loading
        };
    }
    case CHANGE_LAYER_PROPERTY: {
        const targetLayer = state.flat.find((layer) => {return layer.uuid === action.layerUuid; });
        if (!targetLayer) {
            return state;
        }
        const backgroundVisibilityChanged = targetLayer.role === LayerRole.BACKGROUND && action.property === "visibility";

        let parent = targetLayer;
        const parentPath = action.sublayerpath.slice(0, action.sublayerpath.length - 1);
        parentPath.forEach(idx => { parent = parent.sublayers[idx]; });
        const mutexVisibilityChanged = parent.mutuallyExclusive && action.property === "visibility";
        if (mutexVisibilityChanged && action.newvalue === false) {
            // Don't allow explicitly hiding item in mutex group - need to toggle other item
            return state;
        }

        const newLayers = (state.flat || []).map((layer) => {
            if (layer.uuid === action.layerUuid) {

                const {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, action.sublayerpath || []);
                newsublayer[action.property] = action.newvalue;
                const recurseDirection = action.recurseDirection;

                // Handle mutually exclusive groups
                if (mutexVisibilityChanged) {
                    let newParent = newlayer;
                    parentPath.forEach(index => { newParent = newParent.sublayers[index]; });
                    const targetIdx = action.sublayerpath[action.sublayerpath.length - 1];
                    newParent.sublayers = newParent.sublayers.map((l, idx) => ({...l, visibility: idx === targetIdx}));
                }

                if (["children", "both"].includes(recurseDirection)) { // recurse to children (except visibility to children in mutex case)
                    propagateLayerProperty(newsublayer, action.property, action.newvalue);
                }
                if (["parents", "both"].includes(recurseDirection)) { // recurse to parents
                    propagateLayerProperty(newlayer, action.property, action.newvalue, action.sublayerpath);
                }

                if (newlayer.type === "wms") {
                    Object.assign(newlayer, LayerUtils.buildWMSLayerParams(newlayer));
                }
                if (newlayer.role === LayerRole.BACKGROUND) {
                    UrlParams.updateParams({bl: newlayer.visibility ? newlayer.name : ''});
                }
                return newlayer;
            } else if (layer.role === LayerRole.BACKGROUND && backgroundVisibilityChanged) {
                return {...layer, visibility: false};
            }
            return layer;
        });
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        return {...state, flat: newLayers};
    }
    case SET_LAYER_DIMENSIONS: {
        const newLayers = (state.flat || []).map((layer) => {
            if (layer.id === action.layerId) {
                const newLayer = {...layer, dimensionValues: action.dimensions};
                Object.assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                return newLayer;
            }
            return layer;
        });
        return {...state, flat: newLayers};
    }
    case ADD_LAYER: {
        let newLayers = (state.flat || []).concat();
        const layerId = action.layer.id || uuidv4();
        const newLayer = {
            ...action.layer,
            id: layerId,
            name: action.layer.name || layerId,
            role: action.layer.role || LayerRole.USERLAYER,
            queryable: action.layer.queryable || false,
            visibility: action.layer.visibility !== undefined ? action.layer.visibility : true,
            opacity: action.layer.opacity || 255,
            layertreehidden: action.layer.layertreehidden || action.layer.role > LayerRole.USERLAYER
        };
        LayerUtils.addUUIDs(newLayer);
        if (newLayer.type === "wms") {
            Object.assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
        }
        if (action.beforename) {
            newLayers = LayerUtils.insertLayer(newLayers, newLayer, "name", action.beforename);
        } else {
            let inspos = 0;
            if (action.pos === null) {
                for (; inspos < newLayers.length && newLayer.role < newLayers[inspos].role; ++inspos);
            } else {
                inspos = action.pos;
            }
            newLayers.splice(inspos, 0, newLayer);
            // Compress layers if possible
            newLayers = LayerUtils.implodeLayers(LayerUtils.explodeLayers(newLayers));
        }
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        if (newLayer.role === LayerRole.BACKGROUND && newLayer.visibility) {
            UrlParams.updateParams({bl: newLayer.name});
        }
        return {...state, flat: newLayers};
    }
    case ADD_LAYER_SEPARATOR: {
        const newLayers = LayerUtils.insertSeparator(state.flat, action.title, action.afterLayerId, action.afterSublayerPath);
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        return {...state, flat: newLayers};
    }
    case REMOVE_LAYER: {
        const layer = state.flat.find(l => l.id === action.layerId);
        if (!layer) {
            return state;
        }
        let newLayers = state.flat;
        if (layer.role === LayerRole.BACKGROUND || isEmpty(action.sublayerpath)) {
            newLayers = state.flat.filter(l => l.id !== action.layerId);
        } else {
            newLayers = LayerUtils.removeLayer(state.flat, layer, action.sublayerpath);
        }
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        return {...state, flat: newLayers};
    }
    case ADD_LAYER_FEATURES: {
        const layerId = action.layer.id || uuidv4();
        const newLayers = (state.flat || []).concat();
        const idx = newLayers.findIndex(layer => layer.id === layerId);
        if (idx === -1) {
            const newFeatures = action.features.map(function(f) {
                return {...f, id: f.id || (f.properties || {}).id || uuidv4()};
            });
            const newLayer = {
                ...action.layer,
                id: layerId,
                type: 'vector',
                name: action.layer.name || layerId,
                uuid: uuidv4(),
                features: newFeatures,
                role: action.layer.role || LayerRole.USERLAYER,
                queryable: action.layer.queryable || false,
                visibility: action.layer.visibility || true,
                opacity: action.layer.opacity || 255,
                layertreehidden: action.layer.layertreehidden || action.layer.role > LayerRole.USERLAYER,
                bbox: VectorLayerUtils.computeFeaturesBBox(action.features)
            };
            let inspos = 0;
            for (; inspos < newLayers.length && newLayer.role < newLayers[inspos].role; ++inspos);
            newLayers.splice(inspos, 0, newLayer);
        } else {
            const addFeatures = action.features.map(f => ({
                ...f, id: f.id || (f.properties || {}).id || uuidv4()
            }));
            const newFeatures = action.clear ? addFeatures : [
                ...(newLayers[idx].features || []).filter(f => !addFeatures.find(g => g.id === f.id)),
                ...addFeatures
            ];
            newLayers[idx] = {...newLayers[idx], features: newFeatures, bbox: VectorLayerUtils.computeFeaturesBBox(newFeatures), rev: action.layer.rev};
        }
        return {...state, flat: newLayers};
    }
    case REMOVE_LAYER_FEATURES: {
        let changed = false;
        const newLayers = (state.flat || []).reduce((result, layer) => {
            if (layer.id === action.layerId) {
                const newFeatures = (layer.features || []).filter(f => action.featureIds.includes(f.id) === false);
                if (!isEmpty(newFeatures) || action.keepEmptyLayer) {
                    result.push({...layer, features: newFeatures, bbox: VectorLayerUtils.computeFeaturesBBox(newFeatures)});
                }
                changed = true;
            } else {
                result.push(layer);
            }
            return result;
        }, []);
        if (changed) {
            return {...state, flat: newLayers};
        } else {
            return state;
        }
    }
    case CLEAR_LAYER: {
        const newLayers = (state.flat || []).map(layer => {
            if (layer.id === action.layerId) {
                return {...layer, features: [], bbox: null};
            } else {
                return layer;
            }
        });
        return {...state, flat: newLayers};
    }
    case ADD_THEME_SUBLAYER: {
        const themeLayerIdx = state.flat.findIndex(layer => layer.role === LayerRole.THEME);
        if (themeLayerIdx >= 0) {
            const newLayers = state.flat.slice(0);
            newLayers[themeLayerIdx] = LayerUtils.mergeSubLayers(state.flat[themeLayerIdx], action.layer);
            newLayers[themeLayerIdx].visibility = true;
            Object.assign(newLayers[themeLayerIdx], LayerUtils.buildWMSLayerParams(newLayers[themeLayerIdx]));
            UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
            return {...state, flat: newLayers};
        }
        return state;
    }
    case REFRESH_LAYER: {
        const newLayers = (state.flat || []).map((layer) => {
            if (action.filter(layer)) {
                return {...layer, rev: +new Date()};
            }
            return layer;
        });
        return {...state, flat: newLayers};
    }
    case REMOVE_ALL_LAYERS: {
        return {...state, flat: [], swipe: null};
    }
    case REORDER_LAYER: {
        const newLayers = LayerUtils.reorderLayer(state.flat, action.layer, action.sublayerpath, action.direction, action.preventSplittingGroups);
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        return {...state, flat: newLayers};
    }
    case REPLACE_PLACEHOLDER_LAYER: {
        let newLayers = state.flat || [];
        if (action.layer) {
            newLayers = newLayers.map(layer => {
                if (layer.type === 'placeholder' && layer.id === action.id) {
                    const newLayer = {
                        ...layer,
                        ...action.layer,
                        role: layer.role,
                        id: layer.id,
                        uuid: layer.uuid
                    };
                    delete newLayer.loading;
                    LayerUtils.addUUIDs(newLayer);
                    if (newLayer.type === "wms") {
                        Object.assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                    }
                    return newLayer;
                } else {
                    return layer;
                }
            });
        } else {
            newLayers = newLayers.filter(layer => !(layer.type === 'placeholder' && layer.id === action.id));
        }
        UrlParams.updateParams({l: LayerUtils.buildWMSLayerUrlParam(newLayers)});
        return {...state, flat: newLayers};
    }
    case SET_SWIPE: {
        return {...state, swipe: action.swipe};
    }
    case SET_LAYERS: {
        return {...state, flat: action.layers};
    }
    case SET_FILTER: {
        return {...state, flat: state.flat.map(layer => {
            if (layer.type === 'wms' && layer.serverType === 'qgis') {
                const newLayer = {
                    ...layer,
                    filterParams: action.filter,
                    filterGeom: action.filterGeom
                };
                Object.assign(newLayer, LayerUtils.buildWMSLayerParams(newLayer));
                return newLayer;
            } else {
                return layer;
            }
        })};
    }
    default:
        return state;
    }
}

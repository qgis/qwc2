/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import {UrlParams} from '../utils/PermaLinkUtils';
import LayerUtils from '../utils/LayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import uuid from 'uuid';
import {
    LayerRole,
    SET_LAYER_LOADING,
    ADD_LAYER,
    ADD_LAYER_SEPARATOR,
    REMOVE_LAYER,
    REORDER_LAYER,
    CHANGE_LAYER_PROPERTY,
    ADD_LAYER_FEATURES,
    REMOVE_LAYER_FEATURES,
    CLEAR_LAYER,
    ADD_THEME_SUBLAYER,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS,
    REPLACE_PLACEHOLDER_LAYER,
    SET_SWIPE,
    SET_LAYERS
} from '../actions/layers';


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
    swipe: null
};

export default function layers(state = defaultState, action) {
    switch (action.type) {
    case SET_LAYER_LOADING: {
        const newLayers = (state.flat || []).map((layer) => {
            return layer.id === action.layerId ? {...layer, loading: action.loading} : layer;
        });
        return {...state, flat: newLayers};
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
    case ADD_LAYER: {
        let newLayers = (state.flat || []).concat();
        const layerId = action.layer.id || uuid.v4();
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
        const layerId = action.layer.id || uuid.v4();
        const newLayers = (state.flat || []).concat();
        const idx = newLayers.findIndex(layer => layer.id === layerId);
        if (idx === -1) {
            const newLayer = {
                ...action.layer,
                id: layerId,
                type: 'vector',
                name: action.layer.name || layerId,
                uuid: uuid.v4(),
                features: action.features,
                role: action.layer.role || LayerRole.USERLAYER,
                queryable: action.layer.queryable || false,
                visibility: action.layer.visibility || true,
                opacity: action.layer.opacity || 255,
                layertreehidden: action.layer.layertreehidden || action.layer.role > LayerRole.USERLAYER,
                bbox: {bounds: VectorLayerUtils.computeFeaturesBBox(action.features)}
            };
            let inspos = 0;
            for (; inspos < newLayers.length && newLayer.role < newLayers[inspos].role; ++inspos);
            newLayers.splice(inspos, 0, newLayer);
        } else {
            const addFeatures = action.features.concat();
            let newFeatures = [];
            if (!action.clear) {
                newFeatures = (newLayers[idx].features || []).map( f => {
                    const fidx = addFeatures.findIndex(g => g.id === f.id);
                    if (fidx === -1) {
                        return f;
                    } else {
                        return addFeatures.splice(fidx, 1)[0];
                    }
                });
            }
            newFeatures = newFeatures.concat(addFeatures);
            newLayers[idx] = {...newLayers[idx], features: newFeatures, bbox: {bounds: VectorLayerUtils.computeFeaturesBBox(newFeatures)}};
        }
        return {...state, flat: newLayers};
    }
    case REMOVE_LAYER_FEATURES: {
        const newLayers = (state.flat || []).reduce((result, layer) => {
            if (layer.id === action.layerId) {
                const newFeatures = layer.features.filter(f => action.featureIds.includes(f.id) === false);
                if (!isEmpty(newFeatures) || action.keepEmptyLayer) {
                    result.push({...layer, features: newFeatures, bbox: {bounds: VectorLayerUtils.computeFeaturesBBox(newFeatures)}});
                }
            } else {
                result.push(layer);
            }
            return result;
        }, []);
        return {...state, flat: newLayers};
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
                return {...layer, rev: (layer.rev || 0) + 1};
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
                    const newLayer = {...action.layer};
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
    default:
        return state;
    }
}

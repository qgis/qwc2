/**
 * Actions for changing the global store.
 * 
 * @namespace Redux Store.Actions
 */
export {
    CHANGE_BROWSER_PROPERTIES,
    changeBrowserProperties
} from './browser';

export {
    TOGGLE_FULLSCREEN,
    requestFullscreen,
    endFullscreen,
    toggleFullscreen,
} from './display';

export {
    SET_EDIT_CONTEXT,
    CLEAR_EDIT_CONTEXT,
    setEditContext,
    clearEditContext,
    setFeatureTemplateFactory,
    getFeatureTemplate
} from './editing';

export {
    SET_IDENTIFY_TOOL,
    setIdentifyEnabled
} from './identify';

export {
    SET_ACTIVE_LAYERINFO,
    setActiveLayerInfo
} from './layerinfo';

export {
    SET_LAYER_LOADING,
    ADD_LAYER,
    ADD_LAYER_SEPARATOR,
    REMOVE_LAYER,
    REORDER_LAYER,
    ADD_LAYER_FEATURES,
    ADD_THEME_SUBLAYER,
    REMOVE_LAYER_FEATURES,
    CLEAR_LAYER,
    CHANGE_LAYER_PROPERTY,
    SET_LAYER_DIMENSIONS,
    REFRESH_LAYER,
    REMOVE_ALL_LAYERS,
    REPLACE_PLACEHOLDER_LAYER,
    SET_SWIPE,
    SET_LAYERS,
    LayerRole,
    addLayer,
    addLayerSeparator,
    removeLayer,
    reorderLayer,
    addLayerFeatures,
    removeLayerFeatures,
    clearLayer,
    addThemeSublayer,
    changeLayerProperty,
    setLayerDimensions,
    setLayerLoading,
    addMarker,
    removeMarker,
    refreshLayer,
    removeAllLayers,
    replacePlaceholderLayer,
    setSwipe,
    setLayers
} from './layers';

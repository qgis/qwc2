/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {addLayer,removeLayer,removeAllLayers} = require("./layers");
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const {changeMapScales, zoomToExtent, zoomToPoint, changeMapCrs} = require("../actions/map");

const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
const CLEAR_CURRENT_THEME = 'CLEAR_CURRENT_THEME';


function clearCurrentTheme() {
    return (dispatch, getState) => {
        dispatch(removeAllLayers());
        dispatch({
            type: CLEAR_CURRENT_THEME
        });
    };
}

function setCurrentTheme(theme, layer, backgroundLayers, zoomExtent, centerZoom) {
    return (dispatch, getState) => {
        if(ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch") === true) {
            let removeLayers = [];
            for(let layer of getState().layers.flat || []) {
                if(layer.group === "background" || layer.isThemeLayer) {
                    removeLayers.push(layer.id);
                }
            }
            for(let layerId of removeLayers) {
                dispatch(removeLayer(layerId));
            }
        } else {
            dispatch(removeAllLayers());
        }

        // add theme layers
        let activebglayer = undefined;
        for (let backgroundLayer of backgroundLayers) {
            if (backgroundLayer.visibility) {
                activebglayer = backgroundLayer.name;
            }
            dispatch(addLayer(backgroundLayer));
        }
        dispatch(addLayer(layer));

        // Reconfigure map
        let initialView = {bounds: zoomExtent.bounds, crs: zoomExtent.crs};
        if(centerZoom) {
            initialView = {center: centerZoom.center, crs: centerZoom.crs};
        }
        dispatch(configureMap(theme.mapCrs, theme.scales || MapUtils.getGoogleMercatorScales(0, 21), initialView || theme.initialBbox));

        dispatch({
            type: SET_CURRENT_THEME,
            theme: theme,
            layer: layer.id
        });
    };
}

module.exports = {
    SET_CURRENT_THEME,
    CLEAR_CURRENT_THEME,
    setCurrentTheme,
    clearCurrentTheme
};

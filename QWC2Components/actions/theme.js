/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const MapUtils = require("../../MapStore2Components/utils/MapUtils");
const ThemeUtils = require("../utils/ThemeUtils");
const {addLayer, removeLayer, removeAllLayers} = require("./layers");
const {configureMap} = require("./map");

const THEMES_LOADED = 'THEMES_LOADED';
const SET_CURRENT_THEME = 'SET_CURRENT_THEME';


function themesLoaded(themes) {
    return {
        type: THEMES_LOADED,
        themes
    };
}

function restoreDefaultTheme() {
    return (dispatch, getState) => {
        let themes = getState().theme.themes;
        dispatch(setCurrentTheme(ThemeUtils.getThemeById(themes, themes.defaultTheme), themes, false));
    };
}

function setCurrentTheme(theme, themes, preserve=true, initialView=null, visibleSublayers = null, visibleBgLayer=null) {
    return (dispatch, getState) => {
        // Remove old layers
        if(preserve && ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch") === true) {
            let removeLayers = getState().layers.flat.filter(layer => layer.group === "background" || layer.isThemeLayer).map(layer => layer.id);
            for(let layerId of removeLayers) {
                dispatch(removeLayer(layerId));
            }
        } else {
            dispatch(removeAllLayers());
        }

        // Preserve extent if desired and possible
        if(preserve && !initialView && ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch") === true) {
            // If crs and scales match and bounding boxes intersect, keep current extent
            let b1 = theme.bbox.bounds;
            let b2 = getState().map.bbox.bounds;
            if(getState().map.projection === theme.mapCrs &&
               (b2[0] >= b1[0] && b2[1] >= b1[1] && b2[2] <= b1[2] && b2[3] <= b1[3])) // theme bbox (b1) includes current bbox (b2)
            {
                initialView = {bounds: getState().map.bbox.bounds, crs: getState().map.projection};
            }
        }

        // Preserve background layer if desired and possible
        if(preserve && !visibleBgLayer && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch") === true) {
            visibleBgLayer = getState().layers.flat.find(layer => layer.group === 'background' && layer.visibility === true);
        }

        // Inherit defaults if necessary
        theme = assign({}, theme, {
            version: theme.version || themes.defaultWMSVersion || "1.3.0",
            scales: theme.scales || themes.defaultScales || MapUtils.getGoogleMercatorScales(0, 21),
            printScales: theme.printScales || themes.defaultPrintScales || undefined,
            printResolutions: theme.printResolutions || themes.defaultPrintResolutions || undefined,
            printGrid: theme.printGrid || themes.defaultPrintGrid || undefined
        });

        // Reconfigure map
        dispatch(configureMap(theme.mapCrs, theme.scales, initialView || theme.initialBbox));

        // Add background layers for theme
        for(let bgLayer of ThemeUtils.createThemeBackgroundLayers(theme, themes, visibleBgLayer)) {
            dispatch(addLayer(bgLayer));
        }

        // Add theme layer
        let themeLayer = ThemeUtils.createThemeLayer(theme, visibleSublayers);
        dispatch(addLayer(themeLayer));

        dispatch({
            type: SET_CURRENT_THEME,
            theme: theme,
            layer: themeLayer.id
        });
    };
}

module.exports = {
    THEMES_LOADED,
    SET_CURRENT_THEME,
    themesLoaded,
    restoreDefaultTheme,
    setCurrentTheme,
};

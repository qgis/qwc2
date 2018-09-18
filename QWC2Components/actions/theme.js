/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const uuid = require('uuid');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const CoordinatesUtils = require("../../MapStore2Components/utils/CoordinatesUtils");
const MapUtils = require("../../MapStore2Components/utils/MapUtils");
const ThemeUtils = require("../utils/ThemeUtils");
const LayerUtils = require("../utils/LayerUtils");
const {addLayer, removeLayer, removeAllLayers, setSwipe} = require("./layers");
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

function setCurrentTheme(theme, themes, preserve=true, initialView=null, visibleLayers=null, visibleBgLayer=null) {
    return (dispatch, getState) => {

        // Get current background layer if it needs to be preserved
        if(preserve && visibleBgLayer === null && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch") === true) {
            let curBgLayer = getState().layers.flat.find(layer => layer.group === 'background' && layer.visibility === true);
            visibleBgLayer = curBgLayer ? curBgLayer.name : null;
        }

        // Remove old layers
        if(preserve && ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch") === true) {
            let removeLayers = getState().layers.flat.filter(layer => layer.group === "background" || layer.isThemeLayer).map(layer => layer.id);
            for(let layerId of removeLayers) {
                dispatch(removeLayer(layerId));
            }
        } else {
            dispatch(removeAllLayers());
        }
        dispatch(setSwipe(undefined));
        if(!theme) {
            return;
        }

        // Preserve extent if desired and possible
        if(preserve && !initialView && ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch") === true) {
            // If crs and scales match and bounding boxes intersect, keep current extent
            let b1 = CoordinatesUtils.reprojectBbox(theme.bbox.bounds, theme.bbox.crs, getState().map.projection);
            let b2 = getState().map.bbox.bounds;
            if(getState().map.projection === theme.mapCrs &&
               (b2[0] >= b1[0] && b2[1] >= b1[1] && b2[2] <= b1[2] && b2[3] <= b1[3])) // theme bbox (b1) includes current bbox (b2)
            {
                initialView = {bounds: getState().map.bbox.bounds, crs: getState().map.projection};
            }
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

        // Configure theme layer with visible sublayers
        let themeLayer = ThemeUtils.createThemeLayer(theme, visibleLayers);

        // Restore external visible layers
        let exploded = LayerUtils.explodeLayers([themeLayer]);

        // - Filter list of visible layers to only incldue theme layers which exist as well as external layers
        visibleLayers = (visibleLayers || []).slice(0).reverse();
        visibleLayers.filter(entry => {
            let isThemeSublayer = exploded.find(themeSublayer => themeSublayer.sublayer.name === entry);
            let isExternalLayer = LayerUtils.splitLayerUrlParam(entry).type !== 'theme';
            return (isThemeSublayer || isExternalLayer);
        })
        // - Iterate over visible layers, and create placeholders for external layers
        // (placeholders will be replaced as soon as capabilities of external layers are available, see StandardApp.jsx)
        for(let i = 0; i < visibleLayers.length; ++i) {
            let visibleLayer = LayerUtils.splitLayerUrlParam(visibleLayers[i]);
            if(i >= exploded.length || exploded[i].sublayer.name !== visibleLayer.name) {
                let placeholder = LayerUtils.explodeLayers([{
                    type: "placeholder",
                    layertreehidden: true,
                    loading: true,
                    source: visibleLayer.type + ':' + visibleLayer.url + '#' + visibleLayer.name,
                    refid: uuid.v4(),
                    uuid: uuid.v4()
                }]);
                exploded.splice(i, 0, placeholder[0]);
            }
        }
        // - Add layers
        let layers = LayerUtils.implodeLayers(exploded);
        for(let layer of layers) {
            dispatch(addLayer(layer, true));
        }

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

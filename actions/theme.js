/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import themeReducer from '../reducers/theme';
ReducerIndex.register("theme", themeReducer);

import isEmpty from 'lodash.isempty';
import {setIdentifyEnabled} from '../actions/identify';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import LayerUtils from '../utils/LayerUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import ThemeUtils from '../utils/ThemeUtils';
import {LayerRole, addLayer, removeLayer, removeAllLayers, replacePlaceholderLayer, setSwipe} from './layers';
import {configureMap} from './map';

export const THEMES_LOADED = 'THEMES_LOADED';
export const SET_THEME_LAYERS_LIST = 'SET_THEME_LAYERS_LIST';
export const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
export const SWITCHING_THEME = 'SWITCHING_THEME';


export function themesLoaded(themes) {
    return {
        type: THEMES_LOADED,
        themes
    };
}

export function setThemeLayersList(theme) {
    return {
        type: SET_THEME_LAYERS_LIST,
        themelist: theme
    };
}

export function finishThemeSetup(dispatch, theme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer) {
    // Create layer
    const themeLayer = ThemeUtils.createThemeLayer(theme, themes);
    let layers = [themeLayer];

    // Restore theme layer configuration, create placeholders for missing layers
    const externalLayers = {};
    if (!isEmpty(permalinkLayers) && ConfigUtils.getConfigProp("storeAllLayersInPermalink")) {
        layers = permalinkLayers;
    } else {
        if (layerConfigs) {
            if (ConfigUtils.getConfigProp("allowReorderingLayers", theme) !== true) {
                layers = LayerUtils.restoreLayerParams(themeLayer, layerConfigs, permalinkLayers, externalLayers);
            } else {
                layers = LayerUtils.restoreOrderedLayerParams(themeLayer, layerConfigs, permalinkLayers, externalLayers);
            }
        }
        if (isEmpty(layers)) {
            layers = [{...themeLayer, sublayers: []}];
        }
    }

    for (const layer of layers.reverse()) {
        dispatch(addLayer(layer, insertPos));
    }

    // Restore external layers
    if (externalLayerRestorer) {
        externalLayerRestorer(externalLayers, themes, (source, layer) => {
            dispatch(replacePlaceholderLayer(source, layer));
        });
    } else {
        for (const key of Object.keys(externalLayers)) {
            const idx = key.indexOf(":");
            const service = key.slice(0, idx);
            const serviceUrl = key.slice(idx + 1);
            ServiceLayerUtils.findLayers(service, serviceUrl, externalLayers[key], theme.mapCrs, (id, layer) => {
                dispatch(replacePlaceholderLayer(id, layer));
            });
        }
    }

    dispatch(setIdentifyEnabled(true, theme));
    dispatch({
        type: SET_CURRENT_THEME,
        theme: theme,
        layer: themeLayer.id
    });
    dispatch({
        type: SWITCHING_THEME,
        switching: false
    });
}

export function setCurrentTheme(theme, themes, preserve = true, initialView = null, layerParams = null, visibleBgLayer = null, permalinkLayers = null, themeLayerRestorer = null, externalLayerRestorer = null) {
    return (dispatch, getState) => {
        dispatch({
            type: SWITCHING_THEME,
            switching: true
        });

        // Get current background layer if it needs to be preserved
        if (preserve && visibleBgLayer === null && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch", theme) === true) {
            const curBgLayer = getState().layers.flat.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
            visibleBgLayer = curBgLayer ? curBgLayer.name : null;
        }

        // Remove old layers
        let insertPos = 0;
        if (preserve && ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch", theme) === true) {
            // Compute insertion position of new theme layers by counting how many non-theme layers remain
            insertPos = getState().layers.flat.filter(layer => layer.role === LayerRole.USERLAYER).length;

            const removeLayers = getState().layers.flat.filter(layer => layer.role !== LayerRole.USERLAYER).map(layer => layer.id);
            for (const layerId of removeLayers) {
                dispatch(removeLayer(layerId));
            }
        } else {
            dispatch(removeAllLayers());
        }
        dispatch(setSwipe(null));
        if (!theme) {
            dispatch({
                type: SWITCHING_THEME,
                switching: false
            });
            return;
        }

        // Inherit defaults if necessary
        theme = {
            ...theme,
            mapCrs: theme.mapCrs || "EPSG:3857",
            version: theme.version || themes.defaultWMSVersion || "1.3.0",
            scales: theme.scales || themes.defaultScales || MapUtils.getGoogleMercatorScales(0, 21),
            printScales: theme.printScales || themes.defaultPrintScales || undefined,
            printResolutions: theme.printResolutions || themes.defaultPrintResolutions || undefined,
            printGrid: theme.printGrid || themes.defaultPrintGrid || undefined
        };

        // Preserve extent if desired and possible
        if (preserve && !initialView && getState().map.projection === theme.mapCrs) {
            if (ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch", theme) === true) {
                // If theme bbox (b1) includes current bbox (b2), keep current extent
                const b1 = CoordinatesUtils.reprojectBbox(theme.bbox.bounds, theme.bbox.crs, getState().map.projection);
                const b2 = getState().map.bbox.bounds;
                if (b2[0] >= b1[0] && b2[1] >= b1[1] && b2[2] <= b1[2] && b2[3] <= b1[3]) {
                    // theme bbox (b1) includes current bbox (b2)
                    initialView = {bounds: getState().map.bbox.bounds, crs: getState().map.projection};
                }
            } else if (ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch", theme) === "force") {
                initialView = {bounds: getState().map.bbox.bounds, crs: getState().map.projection};
            }
        }

        // Reconfigure map
        dispatch(configureMap(theme.mapCrs, theme.scales, initialView || theme.initialBbox));

        // Add background layers for theme
        for (const bgLayer of ThemeUtils.createThemeBackgroundLayers(theme, themes, visibleBgLayer)) {
            dispatch(addLayer(bgLayer));
        }
        if (visibleBgLayer === "") {
            UrlParams.updateParams({bl: ""});
        }

        let layerConfigs = layerParams ? layerParams.map(param => LayerUtils.splitLayerUrlParam(param)) : null;

        if (layerConfigs) {
            layerConfigs = LayerUtils.replaceLayerGroups(layerConfigs, theme);
        }

        // Restore missing theme layers
        let missingThemeLayers = null;
        if (layerConfigs) {
            const layerNames = LayerUtils.getSublayerNames(theme);
            missingThemeLayers = layerConfigs.reduce((missing, layerConfig) => {
                if (layerConfig.type === 'theme' && !layerNames.includes(layerConfig.name)) {
                    return {...missing, [layerConfig.name]: layerConfig};
                } else {
                    return missing;
                }
            }, {});
        }
        if (themeLayerRestorer && !isEmpty(missingThemeLayers)) {
            themeLayerRestorer(Object.keys(missingThemeLayers), theme, (newLayers, newLayerNames) => {
                const newTheme = LayerUtils.mergeSubLayers(theme, {sublayers: newLayers});
                if (newLayerNames) {
                    layerConfigs = layerConfigs.reduce((res, layerConfig) => {
                        if (layerConfig.name in newLayerNames) {
                            return [...res, ...newLayerNames[layerConfig.name].map(name => ({...layerConfig, name}))];
                        } else {
                            return [...res, layerConfig];
                        }
                    }, []);
                }
                finishThemeSetup(dispatch, newTheme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer);
            });
        } else {
            finishThemeSetup(dispatch, theme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer);
        }
    };
}

export function restoreDefaultTheme() {
    return (dispatch, getState) => {
        const themes = getState().theme.themes;
        dispatch(setCurrentTheme(ThemeUtils.getThemeById(themes, themes.defaultTheme), themes, false));
    };
}

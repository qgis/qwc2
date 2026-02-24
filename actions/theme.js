/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReducerIndex from '../reducers/index';
import themeReducer from '../reducers/theme';
ReducerIndex.register("theme", themeReducer);

import isEmpty from 'lodash.isempty';

import {ViewMode} from '../actions/display';
import {setCurrentTask} from '../actions/task';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import ThemeUtils from '../utils/ThemeUtils';
import {LayerRole, addLayer, removeLayer, removeAllLayers, replacePlaceholderLayer, setSwipe} from './layers';
import {configureMap} from './map';
import {showNotification, NotificationType} from './windows';

export const THEMES_LOADED = 'THEMES_LOADED';
export const SET_THEME_LAYERS_LIST = 'SET_THEME_LAYERS_LIST';
export const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
export const SWITCHING_THEME = 'SWITCHING_THEME';


export function themesLoaded(themes) {
    return {
        type: THEMES_LOADED,
        themes: ThemeUtils.applyCommonTranslations(themes || {})
    };
}

export function setThemeLayersList(theme) {
    return {
        type: SET_THEME_LAYERS_LIST,
        themelist: theme
    };
}

export function finishThemeSetup(dispatch, theme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTheme) {
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

    // Add background layers for theme
    let haveVisibleBg = false;
    const bgLayers = ThemeUtils.createThemeBackgroundLayers(theme.backgroundLayers || [], themes, visibleBgLayer, externalLayers);
    if (initialTheme && visibleBgLayer) {
        const visibleLayer = bgLayers.find(entry => entry.visibility)?.name;
        if (visibleLayer !== visibleBgLayer) {
            dispatch(showNotification("missingbglayer", LocaleUtils.tr("app.missingbg", visibleBgLayer), NotificationType.WARN, true));
        }
    }
    for (const bgLayer of bgLayers) {
        haveVisibleBg |= bgLayer.visibility;
        dispatch(addLayer(bgLayer));
    }
    if (!haveVisibleBg) {
        UrlParams.updateParams({bl: ""});
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
                // Don't expose sublayers
                if (layer) {
                    layer.sublayers = null;
                }
                dispatch(replacePlaceholderLayer(id, layer));
            });
        }
    }

    dispatch({
        type: SET_CURRENT_THEME,
        theme: theme
    });

    dispatch({
        type: SWITCHING_THEME,
        switching: false
    });
    const task = theme.config?.startupTask;
    if (task) {
        const mapClickAction = ConfigUtils.getPluginConfig(task.key).mapClickAction;
        dispatch(setCurrentTask(task.key, task.mode, mapClickAction));
    }
}

export function setCurrentTheme(theme, themes, preserve = true, initialExtent = null, layerParams = null, visibleBgLayer = null, permalinkLayers = null, themeLayerRestorer = null, externalLayerRestorer = null) {
    return (dispatch, getState) => {
        const curLayers = getState().layers?.flat || [];
        const mapCrs = theme.mapCrs || themes.defaultMapCrs || "EPSG:3857";
        if (!(mapCrs in CoordinatesUtils.getAvailableCRS())) {
            dispatch(showNotification("missingprojection", LocaleUtils.tr("app.missingprojection", theme.title, mapCrs), NotificationType.WARN, true));
            return;
        }
        const initialTheme = !getState().theme.current;
        dispatch({
            type: SWITCHING_THEME,
            switching: true
        });

        // Get current background layer if it needs to be preserved
        if (preserve && visibleBgLayer === null && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch", theme) === true) {
            const curBgLayer = curLayers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true);
            visibleBgLayer = curBgLayer ? curBgLayer.name : null;
        }

        // Remove old layers
        let insertPos = 0;
        if (preserve && ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch", theme) === true) {
            // Compute insertion position of new theme layers by counting how many non-theme layers remain
            insertPos = curLayers.filter(layer => layer.role === LayerRole.USERLAYER).length;

            const removeLayers = curLayers.filter(layer => layer.role !== LayerRole.USERLAYER).map(layer => layer.id);
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
            mapCrs: mapCrs,
            version: theme.version || themes.defaultWMSVersion || "1.3.0",
            scales: theme.scales || themes.defaultScales || MapUtils.getGoogleMercatorScales(0, 21),
            printScales: theme.printScales || themes.defaultPrintScales || undefined,
            printResolutions: theme.printResolutions || themes.defaultPrintResolutions || undefined,
            printGrid: theme.printGrid || themes.defaultPrintGrid || undefined,
            searchProviders: theme.searchProviders || themes.defaultSearchProviders || undefined,
            backgroundLayers: theme.backgroundLayers || themes.defaultBackgroundLayers || [],
            mapTips: theme.mapTips ?? themes.defaultMapTips ?? undefined,
            defaultDisplayCrs: theme.defaultDisplayCrs || themes.defaultDisplayCrs || undefined
        };

        // Preserve extent if desired and possible
        if (getState().display.viewMode !== ViewMode._3DFullscreen) {
            const curCrs = getState().map.projection;
            if (preserve && !initialExtent && curCrs === theme.mapCrs) {
                const curBounds = getState().map.bbox.bounds;
                if (ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch", theme) === true) {
                    // If theme bbox (b1) includes current bbox (b2), keep current extent
                    const b1 = CoordinatesUtils.reprojectBbox(theme.bbox.bounds, theme.bbox.crs, curCrs);
                    const b2 = curBounds;
                    if (b2[0] >= b1[0] && b2[1] >= b1[1] && b2[2] <= b1[2] && b2[3] <= b1[3]) {
                        // theme bbox (b1) includes current bbox (b2)
                        initialExtent = {bounds: curBounds, crs: curCrs};
                    }
                } else if (ConfigUtils.getConfigProp("preserveExtentOnThemeSwitch", theme) === "force") {
                    initialExtent = {bounds: curBounds, crs: curCrs};
                }
            }
        }

        // Reconfigure map
        dispatch(configureMap(theme.mapCrs, theme.scales, initialExtent || theme.initialBbox, theme.defaultDisplayCrs));
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
                            // If layerConfig exactly matches a restored theme layer, return unchanged config
                            if (newLayerNames[layerConfig.name].length === 1 && newLayerNames[layerConfig.name][0] === layerConfig.name) {
                                return [...res, layerConfig];
                            }
                            // Else, in case multiple theme layers were returned (i.e. layerConfig.name specifies a group)
                            // generate layerConfigs based on the group layerConfig, preserving the opacity/visibility/etc of the sublayer
                            return [...res, ...newLayerNames[layerConfig.name].map(sublayername => {
                                const sublayer = LayerUtils.searchSubLayer({sublayers: newLayers}, "name", sublayername);
                                return {
                                    ...layerConfig,
                                    name: sublayername,
                                    opacity: sublayer.opacity ?? 255,
                                    visibility: sublayer.visibility ?? true,
                                    tristate: sublayer.tristate || false,
                                    style: sublayer.style
                                };
                            })];
                        } else {
                            return [...res, layerConfig];
                        }
                    }, []);
                    const diff = Object.keys(missingThemeLayers).filter(entry => isEmpty(newLayerNames[entry]));
                    if (!isEmpty(diff)) {
                        dispatch(showNotification("missinglayers", LocaleUtils.tr("app.missinglayers", diff.join(", ")), NotificationType.WARN, true));
                    }
                }
                finishThemeSetup(dispatch, newTheme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTheme);
            });
        } else {
            if (!isEmpty(missingThemeLayers)) {
                dispatch(showNotification("missinglayers", LocaleUtils.tr("app.missinglayers", Object.keys(missingThemeLayers).join(", ")), NotificationType.WARN, true));
            }
            finishThemeSetup(dispatch, theme, themes, layerConfigs, insertPos, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTheme);
        }
    };
}

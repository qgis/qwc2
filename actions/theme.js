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
import {LayerRole, addLayer, removeLayer, removeAllLayers, replacePlaceholderLayer, setSwipe,
    setThemeLayersVisibilityPreset} from './layers';
import {configureMap} from './map';
import {showNotification, NotificationType} from './windows';

export const THEMES_LOADED = 'THEMES_LOADED';
export const SET_THEME_LAYERS_LIST = 'SET_THEME_LAYERS_LIST';
export const SET_CURRENT_THEME = 'SET_CURRENT_THEME';


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

export function finishThemeSetup(dispatch, theme, themes, layerConfigs, preserve, prevLayers, prevTheme, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTask, initialVisibilityPreset) {
    let layers = [];
    const externalLayers = {};

    // Get current background layer if it needs to be preserved
    if (preserve && visibleBgLayer === null && ConfigUtils.getConfigProp("preserveBackgroundOnThemeSwitch", theme) === true) {
        visibleBgLayer = prevLayers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility === true)?.name ?? null;
    }
    // Create theme background layers
    const bgLayers = ThemeUtils.createThemeBackgroundLayers(theme.backgroundLayers || [], themes, visibleBgLayer, externalLayers);
    const actuallyVisibleBgLayer = bgLayers.find(entry => entry.visibility)?.name;
    if (!prevTheme && visibleBgLayer && actuallyVisibleBgLayer !== visibleBgLayer) {
        dispatch(showNotification("missingbglayer", LocaleUtils.tr("app.missingbg", visibleBgLayer), NotificationType.WARN, true));
    } else if (actuallyVisibleBgLayer !== visibleBgLayer) {
        visibleBgLayer = null;
    }

    // Remove old layers
    const preserveUserLayers = preserve && ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch", theme) === true;
    let insPos = 0;
    let bgLayerKept = false;
    prevLayers.forEach(layer => {
        if (layer.role === LayerRole.USERLAYER && preserveUserLayers) {
            ++insPos;
        } else if (layer.role === LayerRole.BACKGROUND && layer.name === visibleBgLayer) {
            bgLayerKept = true;
        } else {
            dispatch(removeLayer(layer.id));
        }
    });

    if (theme.url) {
        // Create layer
        const themeLayer = ThemeUtils.createThemeLayer(theme, themes);
        layers.push(themeLayer);
        // Restore theme layer configuration, create placeholders for missing layers
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
    }

    // Add background layers for theme
    for (const bgLayer of bgLayers.reverse()) {
        // If previous visible BG layer kept, insert other BG layers around that layer
        if (!(bgLayer.name === visibleBgLayer && bgLayerKept)) {
            dispatch(addLayer(bgLayer, insPos));
        }
        ++insPos;
    }
    UrlParams.updateParams({bl: actuallyVisibleBgLayer ?? ""});

    for (const layer of layers.reverse()) {
        dispatch(addLayer(layer));
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
                    dispatch(replacePlaceholderLayer(id, layer));
                } else {
                    dispatch(removeLayer(id));
                }
            });
        }
    }

    dispatch({
        type: SET_CURRENT_THEME,
        theme: theme
    });

    if (initialVisibilityPreset) {
        dispatch(setThemeLayersVisibilityPreset(initialVisibilityPreset));
    }

    const section = ConfigUtils.isMobile() ? "mobile" : "desktop";
    const task = initialTask || (theme?.config?.[section]?.startupTask ?? theme?.config?.startupTask) || (!prevTheme ? ConfigUtils.getConfigProp("startupTask") : null);
    if (task) {
        const mapClickAction = ConfigUtils.getPluginConfig(task.key).mapClickAction;
        dispatch(setCurrentTask(task.key, task.mode, mapClickAction, task.data));
    }
}

export function setCurrentTheme(theme, themes, preserve = true, initialExtent = null, layerParams = null, visibleBgLayer = null, permalinkLayers = null, themeLayerRestorer = null, externalLayerRestorer = null, initialTask = null, initialVisibilityPreset = null) {
    return (dispatch, getState) => {
        dispatch(setSwipe(null));
        const mapCrs = theme.mapCrs || themes.defaultMapCrs || "EPSG:3857";
        if (!(mapCrs in CoordinatesUtils.getAvailableCRS())) {
            dispatch(showNotification("missingprojection", LocaleUtils.tr("app.missingprojection", theme.title, mapCrs), NotificationType.WARN, true));
            dispatch(removeAllLayers());
            return;
        }

        const prevLayers = getState().layers?.flat || [];
        const prevTheme = getState().theme.current;

        const defaultExtent = {
            crs: themes.defaultMapCrs ?? "EPSG:3857",
            bounds: themes.defaultMapExtent ?? CoordinatesUtils.reproject([-20037508.34, -20048966.10, 20037508.34, 20048966.10], "EPSG:3857", themes.defaultMapCrs ?? "EPSG:3857")
        };

        // Inherit defaults if necessary
        theme = {
            ...theme,
            mapCrs: mapCrs,
            bbox: theme.bbox ?? defaultExtent,
            initialBbox: theme.initialBbox ?? defaultExtent,
            version: theme.version ?? themes.defaultWMSVersion ?? "1.3.0",
            scales: theme.scales ?? themes.defaultScales ?? MapUtils.getGoogleMercatorScales(0, 21),
            printScales: theme.printScales ?? themes.defaultPrintScales,
            printResolutions: theme.printResolutions ?? themes.defaultPrintResolutions,
            printGrid: theme.printGrid ?? themes.defaultPrintGrid,
            searchProviders: theme.searchProviders ?? themes.defaultSearchProviders,
            backgroundLayers: theme.backgroundLayers?.length ? theme.backgroundLayers : (themes.defaultBackgroundLayers ?? []),
            mapTips: theme.mapTips ?? themes.defaultMapTips,
            defaultDisplayCrs: theme.defaultDisplayCrs || themes.defaultDisplayCrs
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
                finishThemeSetup(dispatch, newTheme, themes, layerConfigs, preserve, prevLayers, prevTheme, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTask, initialVisibilityPreset);
            });
        } else {
            if (!isEmpty(missingThemeLayers)) {
                dispatch(showNotification("missinglayers", LocaleUtils.tr("app.missinglayers", Object.keys(missingThemeLayers).join(", ")), NotificationType.WARN, true));
            }
            finishThemeSetup(dispatch, theme, themes, layerConfigs, preserve, prevLayers, prevTheme, permalinkLayers, externalLayerRestorer, visibleBgLayer, initialTask, initialVisibilityPreset);
        }
    };
}

export function setBlankTheme(themes, initialExtent = null, visibleBgLayer = null) {
    return setCurrentTheme({id: ""}, themes, false, initialExtent, null, visibleBgLayer);
}

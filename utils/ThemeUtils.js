/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import url from 'url';
import {v4 as uuidv4} from 'uuid';

import {LayerRole} from '../actions/layers';
import {SearchResultType} from '../actions/search';
import {NotificationType, showNotification} from '../actions/windows';
import ConfigUtils from './ConfigUtils';
import LayerUtils from './LayerUtils';
import LocaleUtils from './LocaleUtils';

const ThemeUtils = {
    getThemeById(themes, id) {
        for (let i = 0, n = themes.items.length; i < n; ++i) {
            if (themes.items[i].id === id) {
                return themes.items[i];
            }
        }
        for (let i = 0, n = themes.subdirs.length; i < n; ++i) {
            const theme = this.getThemeById(themes.subdirs[i], id);
            if (theme) {
                return theme;
            }
        }
        return null;
    },
    createThemeBackgroundLayers(theme, themes, visibleLayer, externalLayers, dispatch, initialTheme) {
        const bgLayers = [];
        let visibleIdx = -1;
        let defaultVisibleIdx = -1;
        for (const entry of (theme.backgroundLayers || [])) {
            if (!entry.name) {
                continue;
            }
            let bgLayer = themes.backgroundLayers.find(lyr => lyr.name === entry.name);
            if (bgLayer) {
                if (entry.visibility === true) {
                    defaultVisibleIdx = bgLayers.length;
                }
                if (bgLayer.name === visibleLayer) {
                    visibleIdx = bgLayers.length;
                }
                bgLayer = {
                    ...bgLayer,
                    role: LayerRole.BACKGROUND,
                    thumbnail: bgLayer.thumbnail || "img/mapthumbs/default.jpg",
                    visibility: false,
                    opacity: bgLayer.opacity !== undefined ? bgLayer.opacity : 255
                };
                if (bgLayer.resource) {
                    bgLayer.id = uuidv4();
                    bgLayer.type = "placeholder";
                    const params = LayerUtils.splitLayerUrlParam(bgLayer.resource);
                    params.id = bgLayer.id;
                    const key = params.type + ":" + params.url;
                    (externalLayers[key] = externalLayers[key] || []).push(params);
                    delete bgLayer.resource;
                } else if (bgLayer.type === "wms") {
                    bgLayer.version = bgLayer.params.VERSION || bgLayer.version || themes.defaultWMSVersion || "1.3.0";
                } else if (bgLayer.type === "group") {
                    bgLayer.items = bgLayer.items.map(item => {
                        if (item.ref) {
                            const sublayer = themes.backgroundLayers.find(l => l.name === item.ref);
                            if (sublayer) {
                                item = {...item, ...sublayer, ...LayerUtils.buildWMSLayerParams(sublayer)};
                                if (item.type === "wms") {
                                    item.version = item.params.VERSION || item.version || themes.defaultWMSVersion || "1.3.0";
                                }
                                delete item.ref;
                            } else {
                                item = null;
                            }
                        }
                        return item;
                    }).filter(x => x);
                }
                bgLayers.push(bgLayer);
            } else {
                // eslint-disable-next-line
                console.warn("Could not find background layer " + entry.name);
            }
        }
        if (visibleIdx >= 0) {
            bgLayers[visibleIdx].visibility = true;
        } else if (defaultVisibleIdx >= 0 && visibleLayer !== "") {
            bgLayers[defaultVisibleIdx].visibility = true;
        }
        if (initialTheme && visibleIdx === -1 && visibleLayer) {
            dispatch(showNotification("missingbglayer", LocaleUtils.tr("app.missingbg", visibleLayer), NotificationType.WARN, true));
        }
        return bgLayers;
    },
    createThemeLayer(theme, themes, role = LayerRole.THEME, subLayers = []) {
        const urlParts = url.parse(theme.url, true);
        // Resolve relative urls
        if (!urlParts.host) {
            const locationParts = url.parse(window.location.href);
            urlParts.protocol = locationParts.protocol;
            urlParts.host = locationParts.host;
        }
        const baseParams = urlParts.query;
        let layer = {
            type: "wms",
            id: theme.id,
            url: url.format(urlParts),
            version: theme.version || themes.defaultWMSVersion || "1.3.0",
            visibility: true,
            expanded: theme.expanded,
            name: theme.name,
            title: theme.title,
            bbox: theme.bbox,
            sublayers: (Array.isArray(subLayers) && subLayers.length) ? subLayers : theme.sublayers,
            tiled: theme.tiled,
            tileSize: theme.tileSize,
            ratio: !theme.tiled ? 1 : undefined,
            serverType: 'qgis',
            format: theme.format,
            rev: +new Date(),
            role: role,
            attribution: theme.attribution,
            legendUrl: ThemeUtils.inheritBaseUrlParams(theme.legendUrl, theme.url, baseParams),
            printUrl: ThemeUtils.inheritBaseUrlParams(theme.printUrl, theme.url, baseParams),
            featureInfoUrl: ThemeUtils.inheritBaseUrlParams(theme.featureInfoUrl, theme.url, baseParams),
            infoFormats: theme.infoFormats,
            layerTreeHiddenSublayers: theme.layerTreeHiddenSublayers,
            externalLayerMap: {
                ...theme.externalLayerMap,
                ...(theme.externalLayers || []).reduce((res, cur) => {
                    res[cur.internalLayer] = {
                        ...themes.externalLayers.find(entry => entry.name === cur.name)
                    };
                    LayerUtils.completeExternalLayer(res[cur.internalLayer], LayerUtils.searchSubLayer(theme, 'name', cur.internalLayer));
                    return res;
                }, {})
            }
        };
        layer = LayerUtils.recomputeLayerBBox(layer);
        // Drawing order only makes sense if layer reordering is disabled
        if (ConfigUtils.getConfigProp("allowReorderingLayers", theme) !== true) {
            layer.drawingOrder = theme.drawingOrder;
        }
        return layer;
    },
    inheritBaseUrlParams(capabilityUrl, baseUrl, baseParams) {
        if (!capabilityUrl) {
            return baseUrl;
        }
        if (capabilityUrl.split("?")[0] === baseUrl.split("?")[0]) {
            const parts = url.parse(capabilityUrl, true);
            parts.query = {...baseParams, ...parts.query};
            return url.format(parts);
        }
        return capabilityUrl;
    },
    searchThemes(themes, searchtext) {
        const filter = new RegExp(removeDiacritics(searchtext).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
        const matches = [];
        const searchThemeGroup = (themeGroup) => {
            (themeGroup.subdirs || []).forEach(subdir => searchThemeGroup(subdir, filter));
            matches.push(...(themeGroup.items || []).filter(item => {
                return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords || "").match(filter) || removeDiacritics(item.abstract || "").match(filter);
            }));
        };
        searchThemeGroup(themes, filter);
        return isEmpty(matches) ? [] : [{
            id: "themes",
            titlemsgid: "search.themes",
            priority: -1,
            items: matches.map(theme => ({
                type: SearchResultType.THEME,
                id: theme.id,
                text: theme.title,
                theme: theme,
                layer: ThemeUtils.createThemeLayer(theme, themes),
                thumbnail: ConfigUtils.getAssetsPath() + "/" + theme.thumbnail
            }))
        }];
    },
    searchThemeLayers(themes, searchtext) {
        const filter = new RegExp(removeDiacritics(searchtext).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
        const matches = [];
        const searchLayer = (theme, layer, path = []) => {
            (layer.sublayers || []).forEach((sublayer, idx) => {
                const subpath = [...path, idx];
                if (removeDiacritics(sublayer.name).match(filter) || removeDiacritics(sublayer.title).match(filter)) {
                    // Clone theme, ensuring path to layer is visible
                    const newtheme = {...theme};
                    let cur = newtheme;
                    for (let i = 0; i < subpath.length; ++i) {
                        const isMutuallyExclusive = cur.mutuallyExclusive;
                        cur.sublayers = cur.sublayers.map((entry, j) => ({
                            ...entry,
                            visibility: j === subpath[i] || (entry.visibility && !isMutuallyExclusive)
                        }));
                        cur = cur.sublayers[subpath[i]];
                    }
                    matches.push({
                        theme: newtheme,
                        layer: ThemeUtils.createThemeLayer(newtheme, themes, LayerRole.USERLAYER, [cur])
                    });
                }
                searchLayer(theme, sublayer, subpath);
            });
        };
        const searchThemeGroup = (themeGroup) => {
            (themeGroup.subdirs || []).forEach(subdir => searchThemeGroup(subdir, filter));
            (themeGroup.items || []).forEach(item => searchLayer(item, item));
        };
        searchThemeGroup(themes, filter);
        return isEmpty(matches) ? [] : [{
            id: "themelayers",
            titlemsgid: "search.themelayers",
            priority: -1,
            items: matches.map(result => ({
                type: SearchResultType.EXTERNALLAYER,
                id: result.layer.id + ":" + result.layer.sublayers[0].name,
                text: result.layer.title + ": " + result.layer.sublayers[0].title,
                layer: result.layer,
                theme: result.theme
            }))
        }];
    },
    getThemeNames(themes) {
        const names = (themes.items || []).reduce((res, theme) => ({...res, [theme.id]: theme.title}), {});
        (themes.subdirs || []).forEach(group => {
            Object.assign(names, ThemeUtils.getThemeNames(group));
        });
        return names;
    },
    themFlagsAllowed(theme, flagWhitelist, flagBlacklist) {
        const themeFlags = theme?.flags || [];
        if (flagBlacklist && flagBlacklist.find(flag => themeFlags.includes(flag)) !== undefined) {
            return false;
        }
        if (flagWhitelist && flagWhitelist.find(flag => themeFlags.includes(flag)) === undefined) {
            return false;
        }
        return true;
    }
};

export default ThemeUtils;

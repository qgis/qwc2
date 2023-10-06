/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import url from 'url';
import {v4 as uuidv4} from 'uuid';
import {remove as removeDiacritics} from 'diacritics';

import {SearchResultType} from '../actions/search';
import {LayerRole} from '../actions/layers';
import ConfigUtils from './ConfigUtils';
import LayerUtils from './LayerUtils';

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
    createThemeBackgroundLayers(theme, themes, visibleLayer, externalLayers) {
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
        const layer = {
            type: "wms",
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
        const matches = ThemeUtils.searchThemeGroup(themes, filter);
        return isEmpty(matches) ? [] : [{
            id: "themes",
            titlemsgid: "search.themes",
            priority: -1,
            items: matches.map(theme => ({
                type: SearchResultType.THEME,
                id: theme.id,
                text: theme.title,
                theme: theme,
                thumbnail: ConfigUtils.getAssetsPath() + "/" + theme.thumbnail
            }))
        }];
    },
    searchThemeGroup(themeGroup, filter) {
        const matches = [];
        (themeGroup.subdirs || []).map(subdir => matches.push(...ThemeUtils.searchThemeGroup(subdir, filter)));
        matches.push(...(themeGroup.items || []).filter(item => {
            return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords || "").match(filter) || removeDiacritics(item.abstract || "").match(filter);
        }));
        return matches;
    }
};

export default ThemeUtils;

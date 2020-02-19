/**
* Copyright 2018, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const assign = require("object-assign");
const isEmpty = require('lodash.isempty');
const uuid = require('uuid');

const ConfigUtils = require("../utils/ConfigUtils");
const {LayerRole} = require("../actions/layers");
const removeDiacritics = require('diacritics').remove;

const ThemeUtils = {
    getThemeById: function(themes, id) {
        for(let i = 0, n = themes.items.length; i < n; ++i) {
            if(themes.items[i].id === id) {
                return themes.items[i];
            }
        }
        for(let i = 0, n = themes.subdirs.length; i < n; ++i) {
            let theme = this.getThemeById(themes.subdirs[i], id);
            if(theme) {
                return theme;
            }
        }
        return null;
    },
    createThemeBackgroundLayers: function(theme, themes, visibleLayer=null) {
        let bgLayers = [];
        let visibleIdx = -1;
        let defaultVisibleIdx = -1;
        for (let entry of (theme.backgroundLayers || [])) {
            if(!entry.name) {
                continue;
            }
            const bgLayer = themes.backgroundLayers.find(bgLayer => bgLayer.name === entry.name);
            if (bgLayer) {
                if(entry.visibility === true) {
                    defaultVisibleIdx = bgLayers.length;
                }
                if (bgLayer.name === visibleLayer) {
                    visibleIdx = bgLayers.length;
                }
                bgLayers.push(assign({}, bgLayer, {
                    role: LayerRole.BACKGROUND,
                    visibility: false
                }));
            } else {
                console.warn("Could not find background layer " + entry.name);
            }
        }
        if(visibleIdx >= 0) {
            bgLayers[visibleIdx].visibility = true;
        } else if(defaultVisibleIdx >= 0 && visibleLayer !== "") {
            bgLayers[defaultVisibleIdx].visibility = true;
        }
        return bgLayers;
    },
    createThemeLayer: function(theme, themes, role=LayerRole.THEME) {
        let layer = {
            id: theme.name + Date.now().toString(),
            type: "wms",
            url: theme.url,
            version: theme.version,
            visibility: true,
            expanded: theme.expanded,
            name: theme.name,
            title: theme.title,
            boundingBox: theme.bbox,
            sublayers : theme.sublayers,
            tiled: theme.tiled,
            ratio: !theme.tiled ? 1 : undefined,
            format: theme.format,
            role: role,
            attribution: theme.attribution,
            legendUrl: theme.legendUrl,
            printUrl: theme.printUrl,
            featureInfoUrl: theme.featureInfoUrl,
            infoFormats: theme.infoFormats,
            externalLayers: theme.externalLayers.reduce((res, cur) => {
                res[cur.internalLayer] = assign({}, themes.externalLayers.find(entry => entry.name === cur.name));
                res[cur.internalLayer].uuid = uuid.v4();
                return res;
             }, {})
        };
        // Drawing order only makes sense if layer reordering is disabled
        if(ConfigUtils.getConfigProp("allowReorderingLayers", theme) !== true) {
            layer.drawingOrder = theme.drawingOrder;
        }
        return layer;
    },
    searchThemes: function(themes, searchtext, resultType) {
        let filter = new RegExp(removeDiacritics(searchtext).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
        let matches = ThemeUtils.searchThemeGroup(themes, filter);
        return isEmpty(matches) ? [] : [{
            id: "themes",
            titlemsgid: "search.themes",
            priority: -1,
            items: matches.map(theme => ({
                type: resultType,
                id: theme.id,
                text: theme.title,
                theme: theme,
                thumbnail: ConfigUtils.getConfigProp("assetsPath") + "/" + theme.thumbnail
            }))
        }];
    },
    searchThemeGroup: function(themeGroup, filter) {
        let matches = [];
        (themeGroup.subdirs || []).map(subdir => matches.push(...ThemeUtils.searchThemeGroup(subdir, filter)));
        matches.push(...(themeGroup.items || []).filter(item => {
            return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords).match(filter);
        }));
        return matches;
    }
};

module.exports = ThemeUtils;

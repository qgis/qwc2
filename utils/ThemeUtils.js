/**
* Copyright 2018, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const assign = require("object-assign");
const isEmpty = require('lodash.isempty');
const ConfigUtils = require("../utils/ConfigUtils");
const {LayerRole} = require("../actions/layers");
const LayerUtils = require("./LayerUtils");
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
    createThemeLayer: function(theme, visibleLayers=null, role=LayerRole.THEME) {
        let dummy = {sublayers: theme.sublayers};
        LayerUtils.addSublayerIDs(dummy);
        let sublayers = dummy.sublayers;
        if(visibleLayers) {
            let layers = [];
            let opacities = [];
            let entryMatch = /([^\[]+)\[(\d+)]/;
            visibleLayers.map(entry => {
                let match = entryMatch.exec(entry);
                if(match) {
                    layers.push(match[1]);
                    opacities.push(Math.round(255 - parseFloat(match[2]) / 100 * 255));
                } else {
                    layers.push(entry);
                    opacities.push(255);
                }
            });
            if(ThemeUtils.layerReorderingAllowed(theme) !== true) {
                sublayers = LayerUtils.restoreVisibleLayers(sublayers, layers, opacities);
            } else {
                sublayers = LayerUtils.restoreReorderedVisibleLayers(sublayers, layers, opacities);
            }
        }
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
            sublayers : sublayers,
            tiled: theme.tiled,
            ratio: !theme.tiled ? 1 : undefined,
            format: theme.format,
            role: role,
            attribution: theme.attribution,
            legendUrl: theme.legendUrl,
            printUrl: theme.printUrl,
            featureInfoUrl: theme.featureInfoUrl,
            infoFormats: theme.infoFormats,
            uuid: theme.uuid
        };
        // Drawing order only makes sense if layer reordering is disabled
        if(ThemeUtils.layerReorderingAllowed(theme) !== true) {
            assign(layer, {drawingOrder: theme.drawingOrder});
        }
        return layer;
    },
    layerReorderingAllowed: function(theme) {
        let allowReorderingLayers = ConfigUtils.getConfigProp("allowReorderingLayers");
        if(theme.allowReorderingLayers === true || theme.allowReorderingLayers === false) {
            allowReorderingLayers = theme.allowReorderingLayers;
        }
        return allowReorderingLayers;
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

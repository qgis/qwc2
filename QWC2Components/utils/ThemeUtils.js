/**
* Copyright 2018, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const assign = require("object-assign");
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const {LayerRole} = require("../actions/layers");
const LayerUtils = require("./LayerUtils");

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
                    group: 'background',
                    visibility: false
                }));
            } else {
                console.warn("Could not find background layer " + entry.name);
            }
        }
        if(visibleIdx >= 0) {
            bgLayers[visibleIdx].visibility = true;
        } else if(defaultVisibleIdx >= 0) {
            bgLayers[defaultVisibleIdx].visibility = true;
        }
        return bgLayers;
    },
    createThemeLayer: function(theme, visibleLayers=null) {
        let sublayers = theme.sublayers;
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
            if(ConfigUtils.getConfigProp("allowReorderingLayers") !== true) {
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
            ratio: !theme.tiled ? 1 : undefined,
            format: theme.format,
            role: LayerRole.THEME,
            isThemeLayer: true,
            attribution: theme.attribution,
            legendUrl: theme.legendUrl,
            printUrl: theme.printUrl,
            featureInfoUrl: theme.featureInfoUrl,
            infoFormats: theme.infoFormats,
            uuid: theme.uuid
        };
        // Drawing order only makes sense if layer reordering is disabled
        if(ConfigUtils.getConfigProp("allowReorderingLayers") != true) {
            assign(layer, {drawingOrder: theme.drawingOrder});
        }
        return layer;
    }
};

module.exports = ThemeUtils;

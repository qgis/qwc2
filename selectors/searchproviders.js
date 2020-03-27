/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {createSelector} = require('reselect');
const {addSearchResults, SearchResultType} = require("../actions/search");
const {LayerRole} = require('../actions/layers');
const ConfigUtils = require('../utils/ConfigUtils');
const ThemeUtils = require('../utils/ThemeUtils');

const searchProvidersSelector = (searchProviders, providerFactory) => createSelector(
    [state => state.theme, state => state.layers && state.layers.flat || null], (theme, layers) => {
        let availableProviders = {};
        let themeLayerNames = layers.map(layer => layer.role === LayerRole.THEME ? layer.params.LAYERS : "").join(",").split(",").filter(entry => entry);
        let themeProviders = theme && theme.current ? theme.current.searchProviders : [];
        for(let entry of themeProviders) {
            let provider = searchProviders[entry] || (entry.key ? providerFactory(entry) : null);
            if(provider) {
                if(provider.requiresLayer && !themeLayerNames.includes(provider.requiresLayer)) {
                    continue;
                }
                availableProviders[entry.key || entry] = provider;
            }
        }
        if(ConfigUtils.getConfigProp("searchThemes", theme)) {
            availableProviders["themes"] = {
                labelmsgid: "search.themes",
                onSearch: (text, reqId, options, dispatch) => {
                    dispatch(addSearchResults({
                        provider: "themes",
                        reqId: reqId,
                        data: ThemeUtils.searchThemes(theme.themes, text, SearchResultType.THEME)
                    }));
                }
            };
        }
        return availableProviders;
    }
)

module.exports = searchProvidersSelector;

/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createSelector} from 'reselect';
import {addSearchResults, SearchResultType} from '../actions/search';
import {LayerRole} from '../actions/layers';
import ConfigUtils from '../utils/ConfigUtils';
import ThemeUtils from '../utils/ThemeUtils';

export default (searchProviders, providerFactory) => createSelector(
    [state => state.theme, state => state.layers && state.layers.flat || null], (theme, layers) => {
        const availableProviders = {};
        const themeLayerNames = layers.map(layer => layer.role === LayerRole.THEME ? layer.params.LAYERS : "").join(",").split(",").filter(entry => entry);
        const themeProviders = theme && theme.current ? theme.current.searchProviders : [];
        for (const entry of themeProviders) {
            const provider = searchProviders[entry] || (entry.key ? providerFactory(entry) : null);
            if (provider) {
                if (provider.requiresLayer && !themeLayerNames.includes(provider.requiresLayer)) {
                    continue;
                }
                availableProviders[entry.key || entry] = provider;
            }
        }
        if (ConfigUtils.getConfigProp("searchThemes", theme)) {
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
);

/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createSelector} from 'reselect';
import {LayerRole} from '../actions/layers';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';

export default (searchProviders) => createSelector(
    [state => state.theme, state => state.layers && state.layers.flat || null], (theme, layers) => {
        searchProviders = {...searchProviders, ...window.QWC2SearchProviders || {}};
        const availableProviders = {};
        const themeLayerNames = layers.map(layer => layer.role === LayerRole.THEME ? layer.params.LAYERS : "").join(",").split(",").filter(entry => entry);
        const themeProviders = theme && theme.current && theme.current.searchProviders ? theme.current.searchProviders : [];
        for (const entry of themeProviders) {
            const provider = searchProviders[entry.key ?? entry];
            if (provider) {
                if (provider.requiresLayer && !themeLayerNames.includes(provider.requiresLayer)) {
                    continue;
                }
                availableProviders[entry.key ?? entry] = {
                    ...provider,
                    params: entry.params
                };
            }
        }
        if (ConfigUtils.getConfigProp("searchThemes", theme)) {
            availableProviders.themes = {
                labelmsgid: LocaleUtils.trmsg("search.themes"),
                onSearch: (text, options, callback) => {
                    setTimeout(() => callback({results: ThemeUtils.searchThemes(theme.themes, text)}), 50);
                }
            };
        }
        return availableProviders;
    }
);

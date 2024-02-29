/**
 * Copyright 2020-2024 Sourcepole AG
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
        const providerKeys = new Set();
        for (const entry of themeProviders) {
            // Omit qgis provider with field configuration, this is only supported through the FeatureSearch plugin
            if (entry.provider === 'qgis' && entry?.params?.fields) {
                continue;
            }
            // "key" is the legacy name for "provider"
            const provider = searchProviders[entry.provider ?? entry.key ?? entry];
            if (provider) {
                if (provider.requiresLayer && !themeLayerNames.includes(provider.requiresLayer)) {
                    continue;
                }
                let key = entry.provider ?? entry.key ?? entry;
                if (providerKeys.has(key)) {
                    let i = 0;
                    for (i = 0; providerKeys.has(key + "_" + i); ++i);
                    key = key + "_" + i;
                }
                providerKeys.add(key);
                availableProviders[key] = {
                    ...provider,
                    params: entry.params
                };
            }
        }
        if (ConfigUtils.getConfigProp("searchThemes", theme)) {
            availableProviders.themes = {
                labelmsgid: LocaleUtils.trmsg("search.themes"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemes(theme.themes, text)});
                }
            };
        }
        if (ConfigUtils.getConfigProp("searchThemeLayers", theme)) {
            availableProviders.themelayers = {
                labelmsgid: LocaleUtils.trmsg("search.themelayers"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemeLayers(theme.themes, text)});
                }
            };
        }
        return availableProviders;
    }
);

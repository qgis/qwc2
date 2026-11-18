/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createSelector} from 'reselect';

import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {collectSearchProviders} from '../utils/SearchProviders';
import ThemeUtils from '../utils/ThemeUtils';


export default createSelector(
    [
        state => state.theme.current,
        state => state.theme.themes,
        state => state.layers.flat,
        state => state.map.scale,
        state => state.localConfig.customSearchProviders,
        (state, ownProps) => ownProps.view ?? "2D"
    ], (theme, themes, layers, mapScale, customSearchProviders, view) => {
        // Collect active layers/search terms
        const availableProviders = collectSearchProviders(theme, layers, mapScale, view, customSearchProviders);
        if (ConfigUtils.getConfigProp("searchThemes", theme)) {
            availableProviders.themes = {
                labelmsgid: LocaleUtils.trmsg("search.themes"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemes(themes, text)});
                }
            };
        }
        if (ConfigUtils.getConfigProp("searchThemeLayers", theme)) {
            availableProviders.themelayers = {
                labelmsgid: LocaleUtils.trmsg("search.themelayers"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemeLayers(themes, text)});
                }
            };
        }
        return availableProviders;
    }
);

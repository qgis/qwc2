/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createSelector} from 'reselect';

import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import {collectSearchProviders} from '../utils/SearchProviders';
import ThemeUtils from '../utils/ThemeUtils';


export default createSelector(
    [
        state => state.theme.current,
        state => state.theme,
        state => state.layers.flat,
        state => state.map.scales,
        state => state.map.zoom
    ], (theme, themes, layers, scales, zoom) => {
        // Collect active layers/search terms
        const mapScale = MapUtils.computeForZoom(scales, zoom);
        const availableProviders = collectSearchProviders(theme, layers, mapScale);
        if (ConfigUtils.getConfigProp("searchThemes", theme)) {
            availableProviders.themes = {
                labelmsgid: LocaleUtils.trmsg("search.themes"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemes(themes.themes, text)});
                }
            };
        }
        if (ConfigUtils.getConfigProp("searchThemeLayers", theme)) {
            availableProviders.themelayers = {
                labelmsgid: LocaleUtils.trmsg("search.themelayers"),
                onSearch: (text, options, callback) => {
                    callback({results: ThemeUtils.searchThemeLayers(themes.themes, text)});
                }
            };
        }
        return availableProviders;
    }
);

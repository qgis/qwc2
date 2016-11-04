/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
    plugins: {
        MapPlugin: require('./plugins/Map'),
        LocateButtonPlugin: require('./plugins/LocateButton'),
        ZoomInPlugin: require('./plugins/ZoomButtons'),
        ZoomOutPlugin: require('./plugins/ZoomButtons'),
        BackgroundSwitcherButtonPlugin: require('./plugins/BackgroundSwitcherButton'),
        BackgroundSwitcherMenuPlugin: require('./plugins/BackgroundSwitcherMenu'),
        TopBarPlugin: require('./plugins/TopBar'),
        BottomBarPlugin: require('./plugins/BottomBar'),
        MeasurePlugin: require('./plugins/Measure'),
        ThemeSwitcherPlugin: require('./plugins/ThemeSwitcher'),
        LayerTreePlugin: require('./plugins/LayerTree'),
        IdentifyPlugin: require('./plugins/Identify'),
        MapTipPlugin: require('./plugins/MapTip'),
        SharePlugin: require('./plugins/Share'),
        MapCopyrightPlugin: require('./plugins/MapCopyright'),
        PrintPlugin: require('./plugins/Print')
    },
    requires: {}
};

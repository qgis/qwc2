/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
    plugins: {
        MapPlugin: require('../QWC2/ExtraComponents/plugins/Map'),
        LocateButtonPlugin: require('../QWC2/ExtraComponents/plugins/LocateButton'),
        ZoomInPlugin: require('../QWC2/ExtraComponents/plugins/ZoomButtons'),
        ZoomOutPlugin: require('../QWC2/ExtraComponents/plugins/ZoomButtons'),
        BackgroundSwitcherButtonPlugin: require('../QWC2/ExtraComponents/plugins/BackgroundSwitcherButton'),
        BackgroundSwitcherMenuPlugin: require('../QWC2/ExtraComponents/plugins/BackgroundSwitcherMenu'),
        TopBarPlugin: require('../QWC2/ExtraComponents/plugins/TopBar'),
        BottomBarPlugin: require('../QWC2/ExtraComponents/plugins/BottomBar'),
        MeasurePlugin: require('../QWC2/ExtraComponents/plugins/Measure'),
        ThemeSwitcherPlugin: require('../QWC2/ExtraComponents/plugins/ThemeSwitcher'),
        LayerTreePlugin: require('../QWC2/ExtraComponents/plugins/LayerTree'),
        IdentifyPlugin: require('../QWC2/ExtraComponents/plugins/Identify'),
        MapTipPlugin: require('../QWC2/ExtraComponents/plugins/MapTip'),
        SharePlugin: require('../QWC2/ExtraComponents/plugins/Share'),
        MapCopyrightPlugin: require('../QWC2/ExtraComponents/plugins/MapCopyright'),
        PrintPlugin: require('../QWC2/ExtraComponents/plugins/Print'),
        DxfExportPlugin: require('../QWC2/ExtraComponents/plugins/DxfExport')
    },
    requires: {}
};

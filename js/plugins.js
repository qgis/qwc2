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
        OmniBarPlugin: require('../MapStore2/web/client/plugins/OmniBar'),
        ZoomInPlugin: require('../MapStore2/web/client/plugins/ZoomIn'),
        ZoomOutPlugin: require('../MapStore2/web/client/plugins/ZoomOut'),
        BackgroundLayerButtonPlugin: require('./plugins/BackgroundLayerButton'),
        BackgroundSwitcherMenuPlugin: require('./plugins/BackgroundSwitcherMenu'),
        SearchBarPlugin: require('./plugins/SearchBar'),
        SearchResultListPlugin: require('./plugins/SearchResultList'),
        BottomBarPlugin: require('./plugins/BottomBar'),
        AppMenuPlugin: require('./plugins/AppMenu'),
        MeasurePlugin: require('./plugins/Measure')
    },
    requires: {}
};

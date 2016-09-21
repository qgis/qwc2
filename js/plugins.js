/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
    plugins: {
        BurgerMenu: require('../MapStore2/web/client/plugins/BurgerMenu'),
        MapPlugin: require('../MapStore2/web/client/plugins/Map'),
        OmniBarPlugin: require('../MapStore2/web/client/plugins/OmniBar'),
        ZoomInPlugin: require('../MapStore2/web/client/plugins/ZoomIn'),
        ZoomOutPlugin: require('../MapStore2/web/client/plugins/ZoomOut'),
        BackgroundLayerButtonPlugin: require('./plugins/BackgroundLayerButton'),
        SearchBarPlugin: require('./plugins/SearchBar')
    },
    requires: {}
};

/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

import ConfigUtils from '../../../utils/ConfigUtils';

export default {
    create: (options) => {
        return new ol.layer.Tile({
            minResolution: options.minResolution,
            maxResolution: options.maxResolution,
            preload: ConfigUtils.getConfigProp("tilePreloadLevels", null, 0),
            source: new ol.source.OSM({
                url: options.url,
                projection: options.projection,
                ...(options.sourceConfig || {})
            }),
            ...(options.layerConfig || {})
        });
    }
};

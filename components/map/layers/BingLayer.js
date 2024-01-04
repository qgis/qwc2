/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

export default {
    create: (options) => {
        if (!options.apiKey) {
            /* eslint-disable-next-line */
            console.warn("No api-key provided for BingMaps layer");
        }
        const layer = new ol.layer.Tile({
            minResolution: options.minResolution,
            maxResolution: options.maxResolution,
            preload: Infinity,
            source: new ol.source.BingMaps({
                projection: options.projection,
                key: options.apiKey,
                imagerySet: options.imagerySet ?? options.name,
                ...(options.sourceConfig || {})
            }),
            ...(options.layerConfig || {})
        });
        return layer;
    }
};

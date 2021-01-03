/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

const checkLoaded = (layer, options) => {
    if (layer.getSource && layer.getSource().getState() === 'error') {
        if (options.onError) {
            options.onError(layer);
        }
    }
    if (layer.getSource && layer.getSource().getState() === 'loading') {
        setTimeout(checkLoaded.bind(null, layer, options), 1000);
    }
};

export default {
    create: (options) => {
        const key = options.apiKey;
        const maxNativeZoom = options.maxNativeZoom || 19;
        const layer = new ol.layer.Tile({
            preload: Infinity,
            source: new ol.source.BingMaps({
                key: key,
                imagerySet: options.name,
                maxZoom: maxNativeZoom
            })
        });
        setTimeout(checkLoaded.bind(null, layer, options), 1000);
        return layer;
    }
};

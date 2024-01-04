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
        return new ol.layer.Image({
            source: new ol.source.ImageStatic({
                url: options.url,
                projection: options.projection,
                imageExtent: options.imageExtent
            })
        });
    },
    update: () => {
    }
};

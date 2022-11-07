/**
 * Copyright 2022 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

export default {
    create: (options) => {
        return new ol.layer.VectorTile({
            source: new ol.source.VectorTile({
                minZoom: options.minZoom ? options.minZoom : 0,
                maxZoom: options.maxZoom ? options.maxZoom : 18,
                projection: options.projection ? options.projection : 'EPSG:3857',
                format: new ol.format.MVT({}),
                url: options.url
            })
        });
    }
};

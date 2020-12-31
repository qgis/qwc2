/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import MapUtils from '../../../../utils/MapUtils';

export default {
    create: (options) => {
        return new ol.layer.Tile({
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility,
            zIndex: options.zIndex,
            minResolution: typeof options.minScale === 'number' ? MapUtils.getResolutionsForScales([options.minScale], options.srs)[0] : undefined,
            maxResolution: typeof options.maxScale === 'number' ? MapUtils.getResolutionsForScales([options.maxScale], options.srs)[0] : undefined,
            source: new ol.source.OSM({
                url: options.url,
                projection: options.projection
            })
        });
    }
};

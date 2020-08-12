/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const MapUtils = require('../../../../utils/MapUtils');

let OSMLayer = {
    create: (options) => {
        return new ol.layer.Tile({
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility,
            zIndex: options.zIndex,
            minResolution: options.minScale == null ? undefined : MapUtils.getResolutionsForScales([options.minScale], options.srs)[0],
            maxResolution: options.maxScale == null ? undefined : MapUtils.getResolutionsForScales([options.maxScale], options.srs)[0],
            source: new ol.source.OSM({
                url: options.url,
                projection: options.projection,
            })
        });
    }
};

module.exports = OSMLayer;

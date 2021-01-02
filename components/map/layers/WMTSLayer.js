/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import MapUtils from '../../../utils/MapUtils';

function getWMSURLs(urls) {
    return urls.map((url) => url.split("?")[0]);
}

export default {
    create: (options) => {
        const urls = getWMSURLs(Array.isArray(options.url) ? options.url : [options.url]);
        const projection = ol.proj.get(options.projection);
        const resolutions = options.resolutions;
        const matrixIds = new Array(options.resolutions.length);
        // generate matrixIds arrays for this WMTS
        for (let z = 0; z < options.resolutions.length; ++z) {
            matrixIds[z] = options.tileMatrixPrefix + z;
        }
        return new ol.layer.Tile({
            minResolution: typeof options.minScale === 'number' ? MapUtils.getResolutionsForScales([options.minScale], options.projection)[0] : undefined,
            maxResolution: typeof options.maxScale === 'number' ? MapUtils.getResolutionsForScales([options.maxScale], options.projection)[0] : undefined,
            source: new ol.source.WMTS({
                urls: urls,
                layer: options.name,
                projection: projection && projection.getExtent() ? projection : null,
                matrixSet: options.tileMatrixSet,
                tileGrid: new ol.tilegrid.WMTS({
                    origin: [options.originX, options.originY],
                    resolutions: resolutions,
                    matrixIds: matrixIds,
                    tileSize: options.tileSize || [256, 256]
                }),
                style: options.style !== undefined ? options.style : '',
                wrapX: options.wrapX !== undefined ? options.wrapX : true,
                requestEncoding: options.requestEncoding !== undefined ? options.requestEncoding : "REST"
            })
        });
    }
};

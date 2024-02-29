/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

import CoordinatesUtils from '../../../utils/CoordinatesUtils';

function getWMSURLs(urls) {
    return urls.map((url) => url.split("?")[0]);
}

function createWMTSSource(options) {
    const urls = getWMSURLs(Array.isArray(options.url) ? options.url : [options.url]).map((url) => {
        if (options.rev) {
            return url + "?" + options.rev;
        } else {
            return url;
        }
    });
    const projection = ol.proj.get(options.projection);
    const resolutions = options.resolutions;

    const matrixIds = new Array(options.resolutions.length);
    // generate matrixIds arrays for this WMTS
    for (let z = 0; z < options.resolutions.length; ++z) {
        matrixIds[z] = options.tileMatrixPrefix + z;
    }
    const extent = options.bbox ? CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, options.projection) : null;

    return new ol.source.WMTS({
        urls: urls,
        layer: options.name,
        format: options.format,
        projection: projection ? projection : null,
        matrixSet: options.tileMatrixSet,
        tileGrid: new ol.tilegrid.WMTS({
            extent: extent,
            origin: [options.originX, options.originY],
            resolutions: resolutions,
            matrixIds: matrixIds,
            tileSize: options.tileSize || [256, 256]
        }),
        style: options.style !== undefined ? options.style : '',
        wrapX: options.wrapX !== undefined ? options.wrapX : true,
        requestEncoding: options.requestEncoding !== undefined ? options.requestEncoding : "REST",
        ...(options.sourceConfig || {})
    });
}

export default {
    create: (options) => {
        return new ol.layer.Tile({
            minResolution: options.minResolution,
            maxResolution: options.maxResolution,
            source: createWMTSSource(options),
            ...(options.layerConfig || {})
        });
    },
    update: (layer, newOptions, oldOptions) => {
        if (newOptions.rev !== oldOptions.rev) {
            layer.setSource(createWMTSSource(newOptions));
        }
    }
};

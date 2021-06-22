/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import ConfigUtils from '../../../utils/ConfigUtils';
import MapUtils from '../../../utils/MapUtils';


function wmsToOpenlayersOptions(options) {
    return {
        ...options.baseParams,
        LAYERS: options.name,
        STYLES: options.style || "",
        FORMAT: options.format || 'image/png',
        TRANSPARENT: options.transparent !== undefined ? options.transparent : true,
        SRS: options.projection,
        CRS: options.projection,
        TILED: options.tiled || false,
        VERSION: options.version || "1.3.0",
        DPI: options.dpi || ConfigUtils.getConfigProp("wmsDpi") || 96,
        ...options.params
    };
}

function getWMSURLs( urls ) {
    return urls.map((url) => url.split("?")[0]);
}

export default {
    create: (options, map) => {
        const urls = getWMSURLs(Array.isArray(options.url) ? options.url : [options.url]);
        const queryParameters = wmsToOpenlayersOptions(options) || {};
        if (options.tiled && !options.bbox) {
            console.warn("Tiled WMS requested without specifying bounding box, falling back to non-tiled.");
        }
        if (!options.tiled || !options.bbox) {
            const layer = new ol.layer.Image({
                minResolution: typeof options.minScale === 'number' ? MapUtils.getResolutionsForScales([options.minScale], options.projection)[0] : undefined,
                maxResolution: typeof options.maxScale === 'number' ? MapUtils.getResolutionsForScales([options.maxScale], options.projection)[0] : undefined,
                source: new ol.source.ImageWMS({
                    url: urls[0],
                    serverType: options.serverType,
                    params: queryParameters,
                    ratio: options.ratio || 1,
                    hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false
                })
            });
            layer.set("empty", !queryParameters.LAYERS);
            return layer;
        }
        const extent = CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, options.projection);
        const tileGrid = new ol.tilegrid.TileGrid({
            extent: extent,
            tileSize: options.tileSize || 256,
            maxZoom: map.getView().getResolutions().length,
            resolutions: map.getView().getResolutions()
        });
        const layer = new ol.layer.Tile({
            minResolution: typeof options.minScale === 'number' ? MapUtils.getResolutionsForScales([options.minScale], options.projection)[0] : undefined,
            maxResolution: typeof options.maxScale === 'number' ? MapUtils.getResolutionsForScales([options.maxScale], options.projection)[0] : undefined,
            source: new ol.source.TileWMS({
                urls: urls,
                params: queryParameters,
                serverType: options.serverType,
                tileGrid: tileGrid,
                hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false
            })
        });
        layer.set("empty", !queryParameters.LAYERS);
        return layer;
    },
    update: (layer, newOptions, oldOptions) => {
        if (oldOptions && layer && layer.getSource() && layer.getSource().updateParams) {
            let changed = (oldOptions.rev || 0) !== (newOptions.rev || 0);
            if (oldOptions.params && newOptions.params) {
                changed |= Object.keys(oldOptions.params).reduce((found, param) => {
                    if (newOptions.params[param] !== oldOptions.params[param]) {
                        return true;
                    }
                    return found;
                }, false);
            } else if (!oldOptions.params && newOptions.params) {
                changed = true;
            }
            const oldParams = wmsToOpenlayersOptions(oldOptions);
            const newParams = wmsToOpenlayersOptions(newOptions);
            changed |= ["LAYERS", "STYLES", "FORMAT", "TRANSPARENT", "TILED", "VERSION" ].reduce((found, param) => {
                if (oldParams[param] !== newParams[param]) {
                    return true;
                }
                return found;
            }, false);
            if (changed) {
                layer.set("empty", !newParams.LAYERS);
                layer.getSource().updateParams(Object.assign(newParams, {...newOptions.params, t: new Date().getMilliseconds()}));
                layer.getSource().changed();
            }
        }
    }
};

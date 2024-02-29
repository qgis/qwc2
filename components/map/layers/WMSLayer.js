/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import ol from 'openlayers';
import url from 'url';

import ConfigUtils from '../../../utils/ConfigUtils';
import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import MiscUtils from '../../../utils/MiscUtils';


function wmsToOpenlayersOptions(options) {
    const urlParams = Object.entries(url.parse(options.url, true).query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
    return {
        ...urlParams,
        LAYERS: options.name,
        STYLES: options.style || "",
        FORMAT: options.format || 'image/png',
        TRANSPARENT: options.transparent !== undefined ? options.transparent : true,
        SRS: options.projection,
        CRS: options.projection,
        TILED: String(urlParams.TILED ?? options.tiled ?? false).toLowerCase() === "true",
        VERSION: options.version,
        ...options.params
    };
}

function wmsImageLoadFunction(image, src) {
    const maxUrlLength = ConfigUtils.getConfigProp("wmsMaxGetUrlLength", null, 2048);
    if (src.length > maxUrlLength) {
        // Switch to POST if url is too long
        const urlParts = src.split("?");
        if (location.origin === (new URL(urlParts)).origin) {
            urlParts[1] += "&csrf_token=" + MiscUtils.getCsrfToken();
        }
        const options = {
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            responseType: "blob"
        };
        axios.post(urlParts[0], urlParts[1], options).then(response => {
            const reader = new FileReader();
            reader.readAsDataURL(response.data);
            reader.onload = () => {
                image.src = reader.result;
            };
        }).catch(() => {
            // Fall back to GET
            image.src = src;
        });
    } else {
        image.src = src;
    }
}

export default {
    create: (options, map) => {
        const queryParameters = {...wmsToOpenlayersOptions(options), __t: +new Date()};
        if (queryParameters.TILED && !options.bbox) {
            /* eslint-disable-next-line */
            console.warn("Tiled WMS requested without specifying bounding box, falling back to non-tiled.");
        }
        if (!queryParameters.TILED || !options.bbox) {
            const layer = new ol.layer.Image({
                minResolution: options.minResolution,
                maxResolution: options.maxResolution,
                source: new ol.source.ImageWMS({
                    url: options.url.split("?")[0],
                    serverType: options.serverType,
                    params: queryParameters,
                    ratio: options.ratio || 1,
                    hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false,
                    imageLoadFunction: (image, src) => wmsImageLoadFunction(image.getImage(), src),
                    ...(options.sourceConfig || {})
                }),
                ...(options.layerConfig || {})
            });
            layer.set("empty", !queryParameters.LAYERS);
            return layer;
        } else {
            const extent = CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, options.projection);
            const tileGrid = new ol.tilegrid.TileGrid({
                extent: extent,
                tileSize: options.tileSize || 256,
                maxZoom: map.getView().getResolutions().length,
                resolutions: map.getView().getResolutions()
            });
            const layer = new ol.layer.Tile({
                minResolution: options.minResolution,
                maxResolution: options.maxResolution,
                source: new ol.source.TileWMS({
                    urls: [options.url.split("?")[0]],
                    params: queryParameters,
                    serverType: options.serverType,
                    tileGrid: tileGrid,
                    hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false,
                    tileLoadFunction: (imageTile, src) => wmsImageLoadFunction(imageTile.getImage(), src),
                    ...(options.sourceConfig || {})
                }),
                ...(options.layerConfig || {})
            });
            layer.set("empty", !queryParameters.LAYERS);
            return layer;
        }
    },
    update: (layer, newOptions, oldOptions) => {
        if (oldOptions && layer && layer.getSource() && layer.getSource().updateParams) {
            let changed = (oldOptions.rev || 0) !== (newOptions.rev || 0);
            const oldParams = wmsToOpenlayersOptions(oldOptions);
            const newParams = wmsToOpenlayersOptions(newOptions);
            Object.keys(oldParams).forEach(key => {
                if (!(key in newParams)) {
                    newParams[key] = undefined;
                }
            });
            if (!changed) {
                changed = Object.keys(newParams).find(key => {
                    return newParams[key] !== oldParams[key];
                }) !== undefined;
            }
            changed |= newOptions.visibility !== oldOptions.visibility;
            if (changed) {
                const queryParameters = {...newParams,  __t: +new Date()};
                if (layer.get("updateTimeout")) {
                    clearTimeout(layer.get("updateTimeout"));
                }
                if (!newOptions.visibility || !queryParameters.LAYERS) {
                    layer.setVisible(false);
                }
                layer.set("updateTimeout", setTimeout(() => {
                    layer.setVisible(queryParameters.LAYERS && newOptions.visibility);
                    layer.getSource().updateParams(queryParameters);
                    layer.getSource().changed();
                    layer.set("updateTimeout", null);
                }, 500));
            }
        }
    }
};

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


export function wmsImageLoadFunction(image, src) {
    const maxUrlLength = ConfigUtils.getConfigProp("wmsMaxGetUrlLength", null, 2048);
    const postOrigins = ConfigUtils.getConfigProp("wmsPostOrigins", null, []);
    const reqOrigin = (new URL(src, location.href)).origin;
    if (src.length > maxUrlLength && (location.origin === reqOrigin || postOrigins.includes(reqOrigin))) {
        // Switch to POST if url is too long
        const urlParts = src.split("?");
        urlParts[1] += "&csrf_token=" + MiscUtils.getCsrfToken();
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

export function wmsToOpenlayersOptions(options) {
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
        DPI: options.serverType === 'qgis' ? (options.dpi || ConfigUtils.getConfigProp("wmsDpi") || 96) : undefined,
        ...options.params
    };
}

export function getClientSideOpacity(options, queryParameters) {
    // If no OPACITIES in WMS params, just return options.opacity
    if (!queryParameters.OPACITIES) {
        return (options.opacity ?? 255) / 255;
    }
    // If WMS parameters contain only one opacity value, set opacity client side (as some WMS servers don't support opacity)
    const opacities = (queryParameters.OPACITIES ?? "255").split(",");
    if (opacities.length === 1) {
        queryParameters.OPACITIES = "255";
        return parseInt(opacities[0], 10) / 255;
    }
    return undefined;
}

export default {
    create: (options, map) => {
        const queryParameters = {...wmsToOpenlayersOptions(options), __t: +new Date()};
        const clientSideOpacity = getClientSideOpacity(options, queryParameters);
        if (queryParameters.TILED && !options.bbox) {
            /* eslint-disable-next-line */
            console.warn("Tiled WMS requested without specifying bounding box, falling back to non-tiled.");
        }
        let layer = null;
        if (!queryParameters.TILED || !options.bbox) {
            layer = new ol.layer.Image({
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
        } else {
            const extent = CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, options.projection);
            const tileGrid = new ol.tilegrid.TileGrid({
                extent: extent,
                tileSize: options.tileSize || 256,
                maxZoom: map.getView().getResolutions().length,
                resolutions: map.getView().getResolutions()
            });
            layer = new ol.layer.Tile({
                minResolution: options.minResolution,
                maxResolution: options.maxResolution,
                preload: ConfigUtils.getConfigProp("tilePreloadLevels", null, 0),
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
        }
        layer.setVisible(queryParameters.LAYERS && options.visibility);
        layer.setOpacity(clientSideOpacity ?? 100);
        return layer;
    },
    update: (layer, newOptions, oldOptions) => {
        if (oldOptions && layer?.getSource()?.updateParams) {
            let changed = (oldOptions.rev || 0) !== (newOptions.rev || 0);
            const oldParams = wmsToOpenlayersOptions(oldOptions);
            getClientSideOpacity(oldOptions, oldParams);
            const newParams = wmsToOpenlayersOptions(newOptions);
            const clientSideOpacity = getClientSideOpacity(newOptions, newParams);
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
                layer.setOpacity(clientSideOpacity ?? 100);
                layer.set("updateTimeout", setTimeout(() => {
                    layer.setVisible(queryParameters.LAYERS && newOptions.visibility);
                    layer.getSource().updateParams(queryParameters);
                    layer.getSource().changed();
                    layer.set("updateTimeout", null);
                }, 500));
            } else {
                layer.setOpacity(clientSideOpacity ?? 100);
            }
        }
    }
};

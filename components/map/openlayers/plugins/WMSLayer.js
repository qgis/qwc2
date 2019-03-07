/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const assign = require('object-assign');
const CoordinatesUtils = require('../../../../utils/CoordinatesUtils');
const ConfigUtils = require('../../../../utils/ConfigUtils');
const ProxyUtils = require('../../../../utils/ProxyUtils');


function wmsToOpenlayersOptions(options) {
    // NOTE: can we use opacity to manage visibility?
    return assign({}, options.baseParams, {
        LAYERS: options.name,
        STYLES: options.style || "",
        FORMAT: options.format || 'image/png',
        TRANSPARENT: options.transparent !== undefined ? options.transparent : true,
        SRS: CoordinatesUtils.normalizeSRS(options.srs || 'EPSG:3857', options.allowedSRS),
        CRS: CoordinatesUtils.normalizeSRS(options.srs || 'EPSG:3857', options.allowedSRS),
        TILED: options.tiled || false,
        VERSION: options.version || "1.3.0",
        DPI: options.dpi || ConfigUtils.getConfigProp("wmsDpi") || 90
    }, options.params || {});
}

function getWMSURLs( urls ) {
    return urls.map((url) => url.split("\?")[0]);
}

function proxyTileLoadFunction(imageTile, src) {
    imageTile.getImage().src = ProxyUtils.addProxyIfNeeded(src);
}

let WMSLayer = {
    create: (options, map) => {
        const urls = getWMSURLs(Array.isArray(options.url) ? options.url : [options.url]);
        const queryParameters = wmsToOpenlayersOptions(options) || {};
        if(options.tiled && !options.boundingBox) {
            console.warn("Tiled WMS requested without specifying bounding box, falling back to non-tiled.");
        }
        if (!options.tiled || !options.boundingBox) {
            return new ol.layer.Image({
                opacity: options.opacity !== undefined ? options.opacity : 1,
                visible: !!queryParameters["LAYERS"] && options.visibility !== false,
                zIndex: options.zIndex,
                source: new ol.source.ImageWMS({
                    url: urls[0],
                    serverType: 'qgis',
                    params: queryParameters,
                    ratio: options.ratio,
                    hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false
                })
            });
        }
        let extent = CoordinatesUtils.reprojectBbox(options.boundingBox.bounds, options.boundingBox.crs, options.srs);
        let tileGrid = new ol.tilegrid.TileGrid({
            extent: extent,
            tileSize: options.tileSize || 256,
            maxZoom: map.getView().getResolutions().length,
            resolutions: map.getView().getResolutions()
        });
        return new ol.layer.Tile({
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility !== false,
            zIndex: options.zIndex,
            source: new ol.source.TileWMS(assign({
              urls: urls,
              params: queryParameters,
              serverType: 'qgis',
              tileGrid: tileGrid,
              hidpi: ConfigUtils.getConfigProp("wmsHidpi") !== false ? true : false
            }, (options.forceProxy) ? {tileLoadFunction: proxyTileLoadFunction} : {}))
        });
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
            let oldParams = wmsToOpenlayersOptions(oldOptions);
            let newParams = wmsToOpenlayersOptions(newOptions);
            changed |= ["LAYERS", "STYLES", "FORMAT", "TRANSPARENT", "TILED", "VERSION" ].reduce((found, param) => {
                if (oldParams[param] !== newParams[param]) {
                    return true;
                }
                return found;
            }, false);
            if (changed) {
                layer.getSource().updateParams(assign(newParams, newOptions.params, {t: new Date().getMilliseconds()}));
                layer.getSource().changed();
                layer.setVisible(newOptions.visibility && !!newParams["LAYERS"]);
            }
        }
    }
};

module.exports = WMSLayer;

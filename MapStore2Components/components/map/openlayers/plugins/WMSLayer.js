/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ol = require('openlayers');
var assign = require('object-assign');
const CoordinatesUtils = require('../../../../utils/CoordinatesUtils');
const ProxyUtils = require('../../../../utils/ProxyUtils');
const SecurityUtils = require('../../../../utils/SecurityUtils');


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
        VERSION: options.version || "1.3.0"
    }, options.params || {});
}

function getWMSURLs( urls ) {
    return urls.map((url) => url.split("\?")[0]);
}

function proxyTileLoadFunction(imageTile, src) {
    imageTile.getImage().src = ProxyUtils.addProxyIfNeeded(src);
}

let WMSLayer = {
    create: (options) => {
        const urls = getWMSURLs(Array.isArray(options.url) ? options.url : [options.url]);
        const queryParameters = wmsToOpenlayersOptions(options) || {};
        urls.forEach(url => SecurityUtils.addAuthenticationParameter(url, queryParameters));
        if (options.singleTile) {
            return new ol.layer.Image({
                opacity: options.opacity !== undefined ? options.opacity : 1,
                visible: options.visibility !== false,
                zIndex: options.zIndex,
                source: new ol.source.ImageWMS({
                    url: urls[0],
                    serverType: 'qgis',
                    params: queryParameters,
                    ratio: options.ratio
                })
            });
        }
        return new ol.layer.Tile({
            opacity: options.opacity !== undefined ? options.opacity : 1,
            visible: options.visibility !== false,
            zIndex: options.zIndex,
            source: new ol.source.TileWMS(assign({
              urls: urls,
              params: queryParameters,
              serverType: 'qgis',
              tileGrid: options.tileSize ? ol.tilegrid.createXYZ({
                  extent: ol.proj.get(CoordinatesUtils.normalizeSRS(options.srs || 'EPSG:3857', options.allowedSRS)).getExtent(),
                  tileSize: options.tileSize
              }) : undefined
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
                layer.getSource().updateParams(assign(newParams, newOptions.params));
                layer.getSource().changed();
            }
        }
    }
};

module.exports = WMSLayer;

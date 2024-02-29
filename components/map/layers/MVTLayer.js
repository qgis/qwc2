/**
 * Copyright 2022 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {applyStyle} from 'ol-mapbox-style';
import ol from 'openlayers';

export default {
    create: (options) => {
        const layer = new ol.layer.VectorTile({
            minResolution: options.minResolution,
            maxResolution: options.maxResolution,
            declutter: options.declutter,
            source: new ol.source.VectorTile({
                projection: options.projection,
                format: new ol.format.MVT({}),
                url: options.url,
                tileGrid: options.tileGridConfig ? new ol.tilegrid.TileGrid({...options.tileGridConfig}) : undefined,
                ...(options.sourceConfig || {})
            }),
            ...(options.layerConfig || {})
        });
        if (options.style) {
            fetch(options.style).then(function(response) {
                response.json().then(function(glStyle) {
                    applyStyle(layer, glStyle, Object.keys(glStyle.sources)[0]);
                });
            });
        }
        return layer;
    }
};

/**
 * Copyright 2022 Oslandia SAS <infos+qwc2@oslandia.com>
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import axios from 'axios';
import { applyStyle } from 'ol-mapbox-style';
import ol from 'openlayers';

export default {
    create: (options) => {
        const createLayer = () => {
            return new ol.layer.VectorTile({
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
        };
        const group = new ol.layer.Group();
        if (options.style) {
            axios.get(options.style).then(response => {
                const glStyle = response.data;
                glStyle.sprite?.startsWith(".") && (glStyle.sprite = new URL(glStyle.sprite, options.style).href);
                glStyle.glyphs?.startsWith(".") && (glStyle.glyphs = new URL(glStyle.glyphs, options.style).href);
                Object.keys(glStyle.sources).forEach(styleSource => {
                    glStyle.sources[styleSource].url?.startsWith(".") && (glStyle.sources[styleSource].url = new URL(glStyle.sources[styleSource].url, options.style).href);
                    const layer = createLayer();
                    applyStyle(layer, glStyle, styleSource, options.styleOptions).then(() => {
                        group.getLayers().push(layer);
                    });
                });
            }).catch(e => {
                /* eslint-disable-next-line */
                console.warn("Unable to load style " + options.style + ": " + String(e));
            });
        } else {
            group.getLayers().push(createLayer());
        }
        return group;
    }
};

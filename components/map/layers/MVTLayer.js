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

function createLayer(url, options) {
    return new ol.layer.VectorTile({
        minResolution: options.minResolution,
        maxResolution: options.maxResolution,
        declutter: options.declutter,
        source: new ol.source.VectorTile({
            projection: options.projection,
            format: new ol.format.MVT({}),
            url: url,
            tileGrid: options.tileGridConfig ? new ol.tilegrid.TileGrid({...options.tileGridConfig}) : undefined,
            ...(options.sourceConfig || {})
        }),
        ...(options.layerConfig || {})
    });
}


export function createFromStyle(style, options, callback) {
    axios.get(style).then(response => {
        const glStyle = response.data;
        glStyle.sprite?.startsWith(".") && (glStyle.sprite = new URL(glStyle.sprite, options.style).href);
        glStyle.glyphs?.startsWith(".") && (glStyle.glyphs = new URL(glStyle.glyphs, options.style).href);
        // Collect used sources
        const usedSources = new Set(
            glStyle.layers.map(l => l.source).filter(Boolean)
        );
        // Create layer for each source
        usedSources.forEach(sourceName => {
            const source = glStyle.sources[sourceName];
            if (source.type !== 'vector' && source.type !== 'geojson') {
                return;
            }
            source.url?.startsWith(".") && (source.url = new URL(source.url, options.style).href);
            if (source.tiles?.length) {
                const layer = createLayer(source.tiles[0], options);
                applyStyle(layer, style, sourceName, options.styleOptions).then(() => {
                    callback(layer);
                }).catch(e => {
                    /* eslint-disable-next-line */
                    console.warn("Unable to apply style " + sourceName + ": " + String(e));
                });
            } else if (source.url) {
                axios.get(source.url).then(response2 => {
                    if (response2.data?.tiles?.length) {
                        const layer = createLayer(response2.data.tiles[0], options, callback);
                        applyStyle(layer, style, sourceName, options.styleOptions).then(() => {
                            callback(layer);
                        }).catch(e => {
                            /* eslint-disable-next-line */
                            console.warn("Unable to apply style " + sourceName + ": " + String(e));
                        });
                    } else {
                        /* eslint-disable-next-line */
                        console.warn("Could not find source tile URL for style " + sourceName);
                    }
                }).catch(() => {
                    /* eslint-disable-next-line */
                    console.warn("Could not find source tile URL for style " + sourceName);
                });
            } else {
                /* eslint-disable-next-line */
                console.warn("Could not find source tile URL for style " + sourceName);
            }
        });
    }).catch(e => {
        /* eslint-disable-next-line */
        console.warn("Unable to load style " + options.style + ": " + String(e));
    });
}

export default {
    create: (options) => {
        const group = new ol.layer.Group();
        if (options.style) {
            createFromStyle(options.style, options, (layer) => {
                group.getLayers().push(layer);
            });
        } else {
            group.getLayers().push(createLayer(options.url, options));
        }
        return group;
    }
};

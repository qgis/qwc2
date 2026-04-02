/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import VectorTileSource from "@giro3d/giro3d/sources/VectorTileSource.js";
import axios from 'axios';
import { applyStyle } from 'ol-mapbox-style';

import {createLayer} from '../../map/layers/MVTLayer';
import {LayerGroup3D} from './Layer3D';

export default {
    create3d: (options, projection) => {
        const create3dLayer = (style = null) => {
            const source = new VectorTileSource({
                url: options.url,
                style: style,
                backgroundColor: "white"
            });
            return new ColorLayer({
                name: options.name,
                source: source
            });
        };
        const group = new LayerGroup3D(options.id);
        if (options.style) {
            axios.get(options.style).then(response => {
                const glStyle = response.data;
                glStyle.sprite?.startsWith(".") && (glStyle.sprite = new URL(glStyle.sprite, options.style).href);
                glStyle.glyphs?.startsWith(".") && (glStyle.glyphs = new URL(glStyle.glyphs, options.style).href);
                Object.keys(glStyle.sources).forEach(styleSource => {
                    glStyle.sources[styleSource].url?.startsWith(".") && (glStyle.sources[styleSource].url = new URL(glStyle.sources[styleSource].url, options.style).href);
                    const olLayer = createLayer(options);
                    applyStyle(olLayer, glStyle, styleSource, options.styleOptions).then(() => {
                        group.addLayer(create3dLayer(olLayer.getStyle()));
                    }).catch(e => {
                        /* eslint-disable-next-line */
                        console.warn("Unable to apply style " + options.style + ": " + String(e));
                    });
                });
            }).catch(e => {
                /* eslint-disable-next-line */
                console.warn("Unable to load style " + options.style + ": " + String(e));
            });
        } else {
            group.addLayer(create3dLayer());
        }
        return group;
    },
    update3d: (mapLayer, newOptions, oldOptions, projection) => {
        // pass
    }
};

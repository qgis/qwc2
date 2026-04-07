/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import VectorTileSource from "@giro3d/giro3d/sources/VectorTileSource.js";

import {createFromStyle} from '../../map/layers/MVTLayer';
import {LayerGroup3D} from './Layer3D';

export default {
    create3d: (options, projection) => {
        const create3dLayer = (url, style = null) => {
            const source = new VectorTileSource({
                url: url,
                style: style
            });
            return new ColorLayer({
                name: options.name,
                source: source
            });
        };
        const group = new LayerGroup3D(options.id);
        if (options.style) {
            createFromStyle(options.style, options, (olLayer) => {
                group.addLayer(create3dLayer(olLayer.getSource().getUrls()[0], olLayer.getStyle()));
            });
        } else {
            group.addLayer(create3dLayer(options.url));
        }
        return group;
    },
    update3d: (mapLayer, newOptions, oldOptions, projection) => {
        // pass
    }
};

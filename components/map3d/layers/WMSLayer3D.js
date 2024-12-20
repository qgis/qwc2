/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import TiledImageSource from '@giro3d/giro3d/sources/TiledImageSource.js';
import ol from 'openlayers';

import {wmsImageLoadFunction, wmsToOpenlayersOptions} from '../../map/layers/WMSLayer';


export default {
    create3d: (options, projection) => {
        const queryParameters = {...wmsToOpenlayersOptions(options), __t: +new Date()};
        return new ColorLayer({
            name: options.name,
            source: new TiledImageSource({
                source: new ol.source.TileWMS({
                    url: options.url.split("?")[0],
                    params: queryParameters,
                    version: options.version,
                    projection: projection,
                    tileLoadFunction: (imageTile, src) => wmsImageLoadFunction(imageTile.getImage(), src)
                })
            })
        });
    },
    update3d: (layer, newOptions, oldOptions, projection) => {
        if (oldOptions && layer?.source?.source?.updateParams) {
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
                if (layer.__updateTimeout) {
                    clearTimeout(layer.__updateTimeout);
                }
                if (!newOptions.visibility || !queryParameters.LAYERS) {
                    layer.visible = false;
                }
                layer.__updateTimeout = setTimeout(() => {
                    layer.visible = queryParameters.LAYERS && newOptions.visibility;
                    layer.source.source.updateParams(queryParameters);
                    layer.source.update();
                    layer.__updateTimeout = null;
                }, 500);
            }
        }
    }
};

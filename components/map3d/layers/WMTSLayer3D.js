/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import TiledImageSource from "@giro3d/giro3d/sources/TiledImageSource.js";

import {createWMTSSource} from '../../map/layers/WMTSLayer';
import {Layer3D} from './Layer3D';


export default {
    create3d: (options, projection) => {
        return new Layer3D(options.id, new ColorLayer({
            name: options.name,
            source: new TiledImageSource({
                source: createWMTSSource({...options, projection})
            })
        }));
    },
    update3d: (mapLayer, newOptions, oldOptions, projection) => {
        // pass
    }
};

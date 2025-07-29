/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import GeoTIFFSource from "@giro3d/giro3d/sources/GeoTIFFSource.js";


export default {
    create3d: (options, projection) => {
        return new ColorLayer({
            name: options.name,
            source: new GeoTIFFSource({
                url: options.url,
                crs: projection
            })
        });
    }
};

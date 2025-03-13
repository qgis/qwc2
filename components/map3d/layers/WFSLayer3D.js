/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import VectorSource from "@giro3d/giro3d/sources/VectorSource.js";
import url from 'url';

import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import FeatureStyles from '../../../utils/FeatureStyles';
import {wfsToOpenlayersOptions} from '../../map/layers/WFSLayer';


export default {
    create3d: (options, projection) => {
        const olOpts = wfsToOpenlayersOptions(options);
        const typeName = options.version < "2.0.0" ? "typeName" : "typeNames";
        let srsName = options.projection;
        if (options.version >= "1.1.0") {
            srsName = CoordinatesUtils.toOgcUrnCrs(options.projection);
        }
        const urlParts = url.parse(options.url, true);
        const urlParams = Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
        delete urlParts.search;
        urlParts.query = {
            ...urlParams,
            SERVICE: 'WFS',
            VERSION: options.version,
            REQUEST: 'GetFeature',
            [typeName]: options.name,
            outputFormat: olOpts.formatName,
            srsName: srsName
        };

        return new ColorLayer({
            name: options.name,
            source: new VectorSource({
                dataProjection: options.projection,
                data: {
                    url: url.format(urlParts),
                    format: olOpts.format
                },
                style: (feature) => FeatureStyles.default(feature, {
                    fillColor: options.color,
                    strokeColor: feature.getGeometry().getType().endsWith("LineString") ? options.color : "#000",
                    strokeWidth: 1,
                    strokeDash: [],
                    circleRadius: 5
                })
            })
        });
    },
    update3d: (layer, newOptions, oldOptions, projection) => {
        // pass
    }
};

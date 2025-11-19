/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import StaticFeatureSource from '@giro3d/giro3d/sources/StaticFeatureSource';
import VectorSource from "@giro3d/giro3d/sources/VectorSource.js";
import ol from 'openlayers';

import FeatureStyles from '../../../utils/FeatureStyles';
import {createFeatures, featureStyleFunction, updateFeatures} from '../../map/layers/VectorLayer';


export default {
    create3d: (options, projection) => {
        return new ColorLayer({
            name: options.name,
            source: new VectorSource({
                dataProjection: CoordinateSystem.fromSrid(projection),
                data: createFeatures(options, projection),
                format: new ol.format.GeoJSON(),
                style: options.styleFunction || (feature => {
                    const styleName = options.styleName || 'default';
                    const styleOptions = options.styleOptions || {};
                    return FeatureStyles[styleName](feature, styleOptions);
                })
            })
        });
    },
    update3d: (layer, newOptions, oldOptions, projection) => {
        if (newOptions.styleName !== oldOptions.styleName || newOptions.styleOptions !== oldOptions.styleOptions) {
            layer.source.setStyle(featureStyleFunction(newOptions));
        } else if (newOptions.styleFunction !== oldOptions.styleFunction) {
            layer.source.setStyle(newOptions.styleFunction);
        }
        if (newOptions.features !== oldOptions.features) {
            updateFeatures(layer.source, newOptions, oldOptions, projection);
        } else if ((oldOptions.rev || 0) !== (newOptions.rev || 0)) {
            layer.source.update();
        }
    },
    getFields: (options) => {
        return new Promise((resolve) => {
            const fields = new Set();
            (options.features || []).forEach(feature => {
                Object.keys(feature.properties).forEach(key => fields.add(key));
            });
            resolve([...fields.values()]);
        });
    },
    createFeatureSource: (layer, options, projection) => {
        const crs = CoordinateSystem.fromSrid(projection);
        return new StaticFeatureSource({
            coordinateSystem: crs,
            features: layer.source.source.getFeatures()
        });
    }
};

/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import FeatureStyles from '../../../utils/FeatureStyles';

export default {
    create: (options) => {
        const source = new ol.source.Vector();
        const format = new ol.format.GeoJSON();

        const features = (options.features || []).reduce((collection, feature) => {
            const featureObject = format.readFeatures({...feature, type: "Feature"});
            featureObject.forEach(f => {
                if (feature.crs && feature.crs !== options.projection) {
                    f.getGeometry().transform(feature.crs, options.projection);
                }
                f.set('styleName', feature.styleName);
                f.set('styleOptions', feature.styleOptions);
                f.set('isText', feature.isText);
                f.set('circleParams', feature.circleParams);
                if (feature.styleName) {
                    f.setStyle(FeatureStyles[feature.styleName](f, feature.styleOptions || {}));
                }
            });
            return collection.concat(featureObject);
        }, []);
        source.addFeatures(features);
        const vectorLayer = new ol.layer.Vector({
            msId: options.id,
            source: source,
            style: feature => {
                const styleName = options.styleName || 'default';
                const styleOptions = options.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            }
        });
        return vectorLayer;
    },
    update: (layer, newOptions, oldOptions) => {
        const oldCrs = oldOptions.projection;
        const newCrs = newOptions.projection;
        if (newCrs !== oldCrs) {
            layer.getSource().forEachFeature((f) => {
                f.getGeometry().transform(oldCrs, newCrs);
            });
        }
        if (newOptions.styleName !== oldOptions.styleName || newOptions.styleOptions !== oldOptions.styleOptions) {
            layer.setStyle(feature => {
                const styleName = newOptions.styleName || 'default';
                const styleOptions = newOptions.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            });
        }
        if (newOptions.features !== oldOptions.features) {
            const format = new ol.format.GeoJSON();
            const source = layer.getSource();

            const oldFeaturesMap = (oldOptions.features || []).reduce((res, f) => {
                res[f.id] = f; return res;
            }, {});
            const newIds = new Set(newOptions.features.map(f => f.id));
            const removed = Object.keys(oldFeaturesMap).filter(id => !newIds.has(id));

            // Remove removed features
            for (const id of removed) {
                const feature = source.getFeatureById(id);
                if (feature) {
                    source.removeFeature(feature);
                }
            }

            // Add / update features
            let newFeatureObjects = [];
            for (const feature of newOptions.features) {
                if (oldFeaturesMap[feature.id] && oldFeaturesMap[feature.id] === feature) {
                    // Unchanged, continue
                    continue;
                }
                if (oldFeaturesMap[feature.id] && oldFeaturesMap[feature.id] !== feature) {
                    // Changed, remove
                    const oldFeature = source.getFeatureById(feature.id);
                    if (oldFeature) {
                        source.removeFeature(oldFeature);
                    }
                }
                // Add new
                const featureObject = format.readFeatures({...feature, type: "Feature"});
                featureObject.forEach(f => {
                    if (feature.crs && feature.crs !== newOptions.projection) {
                        f.getGeometry().transform(feature.crs, newOptions.projection);
                    }
                    f.set('styleName', feature.styleName);
                    f.set('styleOptions', feature.styleOptions);
                    f.set('isText', feature.isText);
                    f.set('circleParams', feature.circleParams);
                    if (feature.styleName) {
                        f.setStyle(FeatureStyles[feature.styleName](f, feature.styleOptions || {}));
                    }
                });
                newFeatureObjects = newFeatureObjects.concat(featureObject);
            }
            if (newFeatureObjects) {
                source.addFeatures(newFeatureObjects);
            }
        }
    },
    render: () => {
        return null;
    }
};

/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

import FeatureStyles from '../../../utils/FeatureStyles';

export default {
    create: (options, map) => {
        const source = new ol.source.Vector();
        const format = new ol.format.GeoJSON();
        const mapCrs = map.getView().getProjection().getCode();

        const features = (options.features || []).reduce((collection, feature) => {
            const featureObject = format.readFeatures({...feature, type: "Feature"});
            featureObject.forEach(f => {
                let featureCrs = feature.crs ?? options.projection ?? mapCrs;
                if (featureCrs.type === "name") {
                    featureCrs = featureCrs.properties.name;
                }
                if (featureCrs !== mapCrs) {
                    f.getGeometry()?.transform(featureCrs, mapCrs);
                }
                const featureStyleName = feature.styleName || options.styleName;
                const featureStyleOptions = {...options.styleOptions, ...feature.styleOptions};
                f.set('styleName', featureStyleName);
                f.set('styleOptions', featureStyleOptions);
                f.set('circleParams', feature.circleParams);
                f.set('shape', feature.shape);
                f.set('measurements', feature.measurements);
                if (featureStyleName) {
                    f.setStyle(FeatureStyles[featureStyleName](f, featureStyleOptions));
                }
            });
            return collection.concat(featureObject);
        }, []);
        source.addFeatures(features);
        const vectorLayer = new ol.layer.Vector({
            msId: options.id,
            source: source,
            style: options.styleFunction || (feature => {
                const styleName = options.styleName || 'default';
                const styleOptions = options.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            })
        });
        return vectorLayer;
    },
    update: (layer, newOptions, oldOptions, map) => {
        const mapCrs = map.getView().getProjection().getCode();

        if (newOptions.styleName !== oldOptions.styleName || newOptions.styleOptions !== oldOptions.styleOptions) {
            layer.setStyle(feature => {
                const styleName = newOptions.styleName || 'default';
                const styleOptions = newOptions.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            });
        } else if (newOptions.styleFunction !== oldOptions.styleFunction) {
            layer.setStyle(newOptions.styleFunction);
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
                    let featureCrs = feature.crs ?? newOptions.projection ?? mapCrs;
                    if (featureCrs.type === "name") {
                        featureCrs = featureCrs.properties.name;
                    }
                    if (featureCrs !== mapCrs) {
                        f.getGeometry()?.transform(featureCrs, mapCrs);
                    }
                    const featureStyleName = feature.styleName || newOptions.styleName;
                    const featureStyleOptions = {...newOptions.styleOptions, ...feature.styleOptions};
                    f.set('styleName', featureStyleName);
                    f.set('styleOptions', featureStyleOptions);
                    f.set('circleParams', feature.circleParams);
                    f.set('shape', feature.shape);
                    f.set('measurements', feature.measurements);
                    if (featureStyleName) {
                        f.setStyle(FeatureStyles[featureStyleName](f, featureStyleOptions));
                    }
                });
                newFeatureObjects = newFeatureObjects.concat(featureObject);
            }
            if (newFeatureObjects) {
                source.addFeatures(newFeatureObjects);
            }
        } else if ((oldOptions.rev || 0) !== (newOptions.rev || 0)) {
            layer.getSource().changed();
        }
    },
    render: () => {
        return null;
    }
};

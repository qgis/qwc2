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


export function createFeatures(options, mapCrs, segmentize = false) {
    const format = new ol.format.GeoJSON();
    return (options.features || []).reduce((collection, featureObj) => {
        const feature = format.readFeature({...featureObj, type: "Feature"});
        let featureCrs = featureObj.crs ?? options.projection ?? mapCrs;
        if (featureCrs.type === "name") {
            featureCrs = featureCrs.properties.name;
        }
        if (featureCrs !== mapCrs) {
            feature.getGeometry()?.transform(featureCrs, mapCrs);
        }
        const featureStyleName = featureObj.styleName || options.styleName;
        const featureStyleOptions = {...options.styleOptions, ...featureObj.styleOptions};
        feature.set('styleName', featureStyleName);
        feature.set('styleOptions', featureStyleOptions);
        if (featureObj.circleParams && !segmentize) {
            feature.set('circleParams', featureObj.circleParams);
            feature.setGeometry(
                new ol.geom.Circle(featureObj.circleParams.center, featureObj.circleParams.radius)
            );
        }
        if (featureObj.shape) {
            feature.set('shape', featureObj.shape);
        }
        if (featureObj.measurements) {
            feature.set('measurements', featureObj.measurements);
        }
        if (featureStyleName) {
            feature.setStyle(FeatureStyles[featureStyleName](feature, featureStyleOptions));
        }
        return [...collection, feature];
    }, []);
}

export function updateFeatures(source, newOptions, oldOptions, mapCrs, segmentize = false) {
    const format = new ol.format.GeoJSON();

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
    const newFeatures = [];
    for (const featureObj of newOptions.features) {
        if (oldFeaturesMap[featureObj.id] && oldFeaturesMap[featureObj.id] === featureObj) {
            // Unchanged, continue
            continue;
        }
        if (oldFeaturesMap[featureObj.id] && oldFeaturesMap[featureObj.id] !== featureObj) {
            // Changed, remove
            const oldFeature = source.getFeatureById(featureObj.id);
            if (oldFeature) {
                source.removeFeature(oldFeature);
            }
        }
        // Add new
        const feature = format.readFeature({...featureObj, type: "Feature"});
        let featureCrs = featureObj.crs ?? newOptions.projection ?? mapCrs;
        if (featureCrs.type === "name") {
            featureCrs = featureCrs.properties.name;
        }
        if (featureCrs !== mapCrs) {
            feature.getGeometry()?.transform(featureCrs, mapCrs);
        }
        if (featureObj.circleParams && !segmentize) {
            feature.setGeometry(
                new ol.geom.Circle(featureObj.circleParams.center, featureObj.circleParams.radius)
            );
        }
        const featureStyleName = featureObj.styleName || newOptions.styleName;
        const featureStyleOptions = {...newOptions.styleOptions, ...featureObj.styleOptions};
        feature.set('styleName', featureStyleName);
        feature.set('styleOptions', featureStyleOptions);
        feature.set('circleParams', featureObj.circleParams);
        feature.set('shape', featureObj.shape);
        feature.set('measurements', featureObj.measurements);
        if (featureStyleName) {
            feature.setStyle(FeatureStyles[featureStyleName](feature, featureStyleOptions));
        }
        newFeatures.push(feature);
    }
    if (newFeatures) {
        source.addFeatures(newFeatures);
    }
}

export function featureStyleFunction(options) {
    return (feature => {
        const styleName = options.styleName || 'default';
        const styleOptions = options.styleOptions || {};
        return FeatureStyles[styleName](feature, styleOptions);
    });
}

export default {
    create: (options, map) => {
        const source = new ol.source.Vector();
        const mapCrs = map.getView().getProjection().getCode();

        const features = createFeatures(options, mapCrs);
        source.addFeatures(features);
        const vectorLayer = new ol.layer.Vector({
            source: source,
            style: options.styleFunction || featureStyleFunction(options)
        });
        return vectorLayer;
    },
    update: (layer, newOptions, oldOptions, map) => {
        const mapCrs = map.getView().getProjection().getCode();

        if (newOptions.styleName !== oldOptions.styleName || newOptions.styleOptions !== oldOptions.styleOptions) {
            layer.setStyle(featureStyleFunction(newOptions));
        } else if (newOptions.styleFunction !== oldOptions.styleFunction) {
            layer.setStyle(newOptions.styleFunction);
        }
        if (newOptions.features !== oldOptions.features) {
            updateFeatures(layer.getSource(), newOptions, oldOptions, mapCrs);
        } else if ((oldOptions.rev || 0) !== (newOptions.rev || 0)) {
            layer.getSource().changed();
        }
    },
    render: () => {
        return null;
    }
};

/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const isEqual = require('lodash.isequal');
const FeatureStyles = require('../FeatureStyles');

let VectorLayer = {
    create: (options, map) => {
        let source = new ol.source.Vector();
        const format = new ol.format.GeoJSON();

        let features = (options.features || []).reduce((collection, feature) => {
            let featureObject = format.readFeatures({...feature, type: "Feature"});
            featureObject.forEach(f => {
                if(feature.crs && feature.crs !== options.srs) {
                    f.getGeometry().transform(feature.crs, options.srs);
                }
                if(feature.styleName) {
                    f.setStyle(FeatureStyles[feature.styleName](f, feature.styleOptions || {}));
                }
            });
            return collection.concat(featureObject);
        }, []);
        source.addFeatures(features);
        let vectorLayer = new ol.layer.Vector({
            msId: options.id,
            source: source,
            zIndex: options.zIndex,
            style: feature => {
                let styleName = options.styleName || 'default';
                let styleOptions = options.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            }
        });
        map.on('click', event => {
            let allFeatures = map.getFeaturesAtPixel(event.pixel);
            let features = map.getFeaturesAtPixel(event.pixel, {layerFilter: (layer) => layer === vectorLayer});
            if(features && features.length > 0 && allFeatures.length === features.length) {
                let feature = features[0];
                let event = document.createEvent('CustomEvent');
                let featureObj = new ol.format.GeoJSON().writeFeatureObject(feature);
                event.initCustomEvent('_qwc2_feature_clicked', false, false, featureObj);
                window.dispatchEvent(event);
            }
        });
        return vectorLayer;
    },
    update: (layer, newOptions, oldOptions) => {
        const oldCrs = oldOptions.srs || 'EPSG:3857';
        const newCrs = newOptions.srs || 'EPSG:3857';
        if (newCrs !== oldCrs) {
            layer.getSource().forEachFeature((f) => {
                f.getGeometry().transform(oldCrs, newCrs);
            });
        }
        if(newOptions.styleName !== oldOptions.styleName || newOptions.styleOptions !== oldOptions.styleOptions) {
            layer.setStyle(feature => {
                let styleName = newOptions.styleName || 'default';
                let styleOptions = newOptions.styleOptions || {};
                return FeatureStyles[styleName](feature, styleOptions);
            });
        }
        if(newOptions.features !== oldOptions.features) {
            const format = new ol.format.GeoJSON();
            let source = layer.getSource();

            let oldFeaturesMap = (oldOptions.features || []).reduce((res, f) => {
                res[f.id] = f; return res;
            }, {});
            let newIds = new Set(newOptions.features.map(f => f.id));
            let removed = Object.keys(oldFeaturesMap).filter(id => !newIds.has(id));

            // Remove removed features
            for(let id of removed) {
                let feature = source.getFeatureById(id);
                if(feature) {
                    source.removeFeature(feature);
                }
            }

            // Add / update features
            let newFeatureObjects = [];
            for(let feature of newOptions.features) {
                if(oldFeaturesMap[feature.id] && oldFeaturesMap[feature.id] === feature) {
                    // Unchanged, continue
                    continue;
                }
                if(oldFeaturesMap[feature.id] && oldFeaturesMap[feature.id] !== feature) {
                    // Changed, remove
                    let oldFeature = source.getFeatureById(feature.id);
                    if(oldFeature) {
                        source.removeFeature(oldFeature);
                    }
                }
                // Add new
                let featureObject = format.readFeatures({...feature, type: "Feature"});
                featureObject.forEach(f => {
                    if(feature.crs && feature.crs !== newOptions.srs) {
                        f.getGeometry().transform(feature.crs, newOptions.srs);
                    }
                    if(feature.styleName) {
                        f.setStyle(FeatureStyles[feature.styleName](f, feature.styleOptions || {}));
                    }
                });
                newFeatureObjects = newFeatureObjects.concat(featureObject);
            }
            if(newFeatureObjects) {
                source.addFeatures(newFeatureObjects);
            }
        }
    },
    render: () => {
        return null;
    }
};

module.exports = VectorLayer;

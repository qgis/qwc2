/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import DrapedFeatureCollection from '@giro3d/giro3d/entities/DrapedFeatureCollection';
import PropTypes from 'prop-types';

import LayerRegistry3D from './layers/index';


export default class ColorLayer3D extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        options: PropTypes.object,
        prevLayerId: PropTypes.string,
        sceneContext: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.layer = null;
    }
    componentDidMount() {
        const layerCreator = LayerRegistry3D[this.props.options.type];
        if (layerCreator) {
            this.layer = layerCreator.create3d(this.props.options, this.props.sceneContext.mapCrs);
            this.props.map.addLayer(this.layer);
            this.layer.userData.layerId = this.props.options.id;
            this.applyLayerOptions(layerCreator, {});
        }
    }
    componentDidUpdate(prevProps) {
        const layerCreator = LayerRegistry3D[this.props.options.type];
        if (this.layer && layerCreator) {
            layerCreator.update3d(this.layer, this.props.options, prevProps.options, this.props.sceneContext.mapCrs);
            this.applyLayerOptions(layerCreator, prevProps.options);
        }
    }
    componentWillUnmount() {
        if (this.layer) {
            this.props.sceneContext.removeSceneObject(this.props.options.id + ":extruded");
            this.props.map.removeLayer(this.layer, {dispose: true});
        }
    }
    applyLayerOptions = (layerCreator, prevOptions) => {
        const options = this.props.options;
        // Reorder layer
        const layerBelow = this.props.map.getLayers(l => l.userData.layerId === this.props.prevLayerId)[0] ?? null;
        this.props.map.insertLayerAfter(this.layer, layerBelow);
        // WMS layer handles visibility and opacity internally
        if (this.props.options.type !== "wms") {
            this.layer.visible = options.visibility;
            this.layer.opacity = options.opacity / 255;
        }
        if (this.props.options.extrusionHeight !== undefined && this.props.options.extrusionHeight !== 0) {
            this.createUpdateExtrudedLayer(layerCreator, this.layer, options, options.features !== prevOptions?.features);
        } else if (prevOptions?.extrusionHeight !== undefined && prevOptions?.extrusionHeight !== 0) {
            this.props.sceneContext.removeSceneObject(this.props.options.id + ":extruded");
        }
    };
    createUpdateExtrudedLayer = (layerCreator, mapLayer, options, forceCreate = false) => {
        const objId = options.id + ":extruded";
        const makeColor = (c) => {
            if (Array.isArray(c)) {
                return ((c[0] << 16) | (c[1] << 8) | c[2]);
            } else if (typeof c === "string") {
                return parseInt(c.replace("#", ""), 16);
            } else {
                return c;
            }
        };
        let obj = this.props.sceneContext.getSceneObject(objId);
        if (!obj || forceCreate) {
            if (obj) {
                this.props.sceneContext.removeSceneObject(objId);
            }
            const layercolor = makeColor(options.color ?? "#FF0000");
            obj = new DrapedFeatureCollection({
                source: layerCreator.createFeatureSource(mapLayer, options, this.props.sceneContext.mapCrs),
                drapingMode: 'per-feature',
                extrusionOffset: (feature) => {
                    if (typeof obj.userData.extrusionHeight === "string") {
                        return parseFloat(feature.getProperties()[obj.userData.extrusionHeight]) || 0;
                    } else {
                        return obj.userData.extrusionHeight;
                    }
                },
                style: (feature) => {
                    return obj.userData.featureStyles?.[feature.getId()] ?? {
                        fill: {color: layercolor, shading: true}
                    };
                }
            });
            obj.castShadow = true;
            obj.receiveShadow = true;
            this.props.sceneContext.addSceneObject(objId, obj, false, {}, false, () => {
                obj.attach(this.props.map);
            });
        }
        obj.userData.extrusionHeight = options.extrusionHeight;
        obj.userData.featureStyles = options.features?.reduce?.((res, feature) => ({
            ...res,
            [feature.id]: {
                fill: {
                    color: makeColor(feature.styleOptions.fillColor),
                    shading: true
                }
            }
        }), {});
        obj.opacity = mapLayer.opacity;
        obj.visible = mapLayer.visible;
        if (obj.visible) {
            obj.updateStyles();
        }
    };
    render() {
        return null;
    }
}

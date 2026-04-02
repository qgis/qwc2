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
        this.mapLayer = null;
    }
    componentDidMount() {
        const layerCreator = LayerRegistry3D[this.props.options.type];
        if (layerCreator) {
            this.mapLayer = layerCreator.create3d(this.props.options, this.props.sceneContext.mapCrs);
            this.mapLayer.attach(this.props.map);
            this.applyLayerOptions(layerCreator, {});
        }
    }
    componentDidUpdate(prevProps) {
        const layerCreator = LayerRegistry3D[this.props.options.type];
        if (this.mapLayer && layerCreator) {
            layerCreator.update3d(this.mapLayer, this.props.options, prevProps.options, this.props.sceneContext.mapCrs);
            this.applyLayerOptions(layerCreator, prevProps.options);
        }
    }
    componentWillUnmount() {
        if (this.mapLayer) {
            this.props.sceneContext.removeSceneObject(this.props.options.id + ":extruded");
            this.mapLayer.dispose();
        }
    }
    applyLayerOptions = (layerCreator, prevOptions) => {
        const options = this.props.options;
        // Reorder layer
        const layerBelow = this.props.map.getLayers(l => l.userData.layerId === this.props.prevLayerId)[0] ?? null;
        this.mapLayer.moveAfter(layerBelow);
        // WMS layer handles visibility and opacity internally
        if (this.props.options.type !== "wms") {
            this.mapLayer.setVisible(options.visibility);
            this.mapLayer.setOpacity(options.opacity / 255);
        }
        if (this.props.options.extrusionHeight !== undefined && this.props.options.extrusionHeight !== 0) {
            this.createUpdateExtrudedLayer(layerCreator, options, options.features !== prevOptions?.features);
        } else if (prevOptions?.extrusionHeight !== undefined && prevOptions?.extrusionHeight !== 0) {
            this.props.sceneContext.removeSceneObject(this.props.options.id + ":extruded");
        }
    };
    createUpdateExtrudedLayer = (layerCreator, options, forceCreate = false) => {
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
                source: layerCreator.createFeatureSource(this.mapLayer, options, this.props.sceneContext.mapCrs),
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
        obj.opacity = this.mapLayer.opacity();
        obj.visible = this.mapLayer.visible();
        if (obj.visible) {
            obj.updateStyles();
        }
    };
    render() {
        return null;
    }
}

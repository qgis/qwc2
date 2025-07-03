/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {CSS2DObject} from 'three/addons/renderers/CSS2DRenderer';

import CoordinatesUtils from '../../utils/CoordinatesUtils';
import FeatureStyles from '../../utils/FeatureStyles';
import VectorLayerUtils from '../../utils/VectorLayerUtils';
import SearchWidget from '../widgets/SearchWidget';
import pinModel from './models/pin.glb';


export default class SearchField3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        searchProviders: PropTypes.object
    };

    render() {
        return (
            <SearchWidget
                queryGeometries
                resultSelected={this.searchResultSelected}
                searchParams={{mapcrs: this.props.sceneContext.mapCrs, displaycrs: this.props.sceneContext.mapCrs}}
                searchProviders={Object.values(this.props.searchProviders)}
                value={""}
            />
        );
    }
    searchResultSelected = (result) => {
        const sceneContext = this.props.sceneContext;
        sceneContext.removeLayer("__searchHighlight");
        sceneContext.removeSceneObject("__searchMarker");
        if (!result) {
            return;
        }
        const mapCrs = sceneContext.mapCrs;
        const scenePos = CoordinatesUtils.reproject([result.x, result.y], result.crs ?? mapCrs, mapCrs);

        // Add higlight geometry
        if (result.feature && result.feature?.geometry?.type !== "Point") {
            const format = new ol.format.GeoJSON();
            const olFeatures = format.readFeatures(result.feature, {
                dataProjection: result.crs ?? mapCrs, featureProjection: mapCrs
            });
            const highlightLayer = new ColorLayer({
                source: new VectorSource({
                    data: olFeatures,
                    format: format,
                    style: (feat) => FeatureStyles.default(feat, {})
                })
            });
            sceneContext.addLayer("__searchHighlight", highlightLayer);
        }

        // Zoom to bounds
        let bounds = result.feature ? VectorLayerUtils.computeFeatureBBox(result.feature) : [
            scenePos[0], scenePos[1],
            scenePos[0], scenePos[1]
        ];
        // Adjust bounds so that we do not zoom further than 1:searchMinScaleDenom
        const bbWidth = bounds[2] - bounds[0];
        const bbHeight = bounds[3] - bounds[1];
        const sceneRect = this.props.sceneContext.scene.viewport.getBoundingClientRect();
        // Compute maximum allowed dimensions at the given scale
        const px2m = 0.0254 / 96;
        const minWidth = sceneRect.width * px2m * this.props.sceneContext.options.searchMinScaleDenom;
        const minHeight = sceneRect.height * px2m * this.props.sceneContext.options.searchMinScaleDenom;
        const scaleFactor = Math.max(bbWidth / minWidth, bbHeight / minHeight);
        if (scaleFactor < 1) {
            const bbCenterX = 0.5 * (bounds[0] + bounds[2]);
            const bbCenterY = 0.5 * (bounds[1] + bounds[3]);
            bounds = [
                bbCenterX - minWidth / 2, bbCenterY - minHeight / 2,
                bbCenterX + minWidth / 2, bbCenterY + minHeight / 2
            ];
        }

        sceneContext.setViewToExtent(bounds, 0);
        // Add pin and label at result position above terrain
        sceneContext.getTerrainHeightFromDTM(scenePos).then((terrainHeight) => {

            const loader = new GLTFLoader();
            loader.load(pinModel, (gltf) => {
                const searchMarker = new Group();

                // Add pin
                const pin = gltf.scene;
                pin.position.x = scenePos[0];
                pin.position.y = scenePos[1];
                pin.position.z = terrainHeight;
                pin.rotation.x = Math.PI / 2;
                pin.updateMatrixWorld();
                searchMarker.add(pin);

                // Add label
                const labelEl = document.createElement("span");
                labelEl.innerText = result.label ?? result.text;
                labelEl.className = "map3d-search-label";
                const label = new CSS2DObject(labelEl);
                label.position.set(scenePos[0], scenePos[1], terrainHeight + 2);
                label.updateMatrixWorld();
                searchMarker.add(label);

                sceneContext.addSceneObject("__searchMarker", searchMarker);

                // Scale search marker with distance
                const scaleSearchMarker = () => {
                    const distance = sceneContext.scene.view.camera.position.distanceTo(pin.position) / 30;
                    const scale = Math.max(20, distance);
                    label.position.z = terrainHeight + 2 * scale;
                    label.updateMatrixWorld();
                    pin.scale.set(scale, scale, scale);
                    pin.updateMatrixWorld();
                };

                sceneContext.scene.view.controls.addEventListener('change', scaleSearchMarker);
                searchMarker.addEventListener('removed', () => {
                    sceneContext.scene.view.controls.removeEventListener('change', scaleSearchMarker);
                    // The label DOM element is not removed when the searchMarker group is removed from the instance
                    labelEl.parentNode.removeChild(labelEl);
                });
            });
        });
    };
}

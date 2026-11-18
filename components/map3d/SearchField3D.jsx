/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader';
import {CSS2DObject} from 'three/addons/renderers/CSS2DRenderer';

import pinModel from '../../resources/pin.glb';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import FeatureStyles from '../../utils/FeatureStyles';
import SearchBox from '../SearchBox';


class SearchField3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        searchOptions: PropTypes.shape({
            minScaleDenom: PropTypes.number
        }),
        theme: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.searchOptions = ConfigUtils.getPluginConfig("TopBar")?.cfg?.searchOptions;
        // Always show markers in 3D view
        this.searchOptions.showHighlightMarker = true;
    }
    render() {
        return (
            <SearchBox
                addLayerFeatures={this.addHighlight}
                clearHighlight={this.clearHighlight}
                searchOptions={this.searchOptions}
                showHighlight={this.showHighlight}
                view="3D"
                zoomToExtent={this.zoomToExtent}
            />
        );
    }
    clearHighlight = () => {
        this.props.sceneContext.removeLayer("__searchHighlight");
        this.props.sceneContext.removeSceneObject("__searchMarker");
    };
    showHighlight = (features) => {
        const sceneContext = this.props.sceneContext;

        const featurecollection = {type: "FeatureCollection", features: []};
        let marker = null;
        features.forEach(feature => {
            if (feature.styleName === 'marker') {
                marker = feature;
            } else {
                featurecollection.features.push(feature);
            }
        });

        if (featurecollection.features.length) {
            const format = new ol.format.GeoJSON();
            const olFeatures = format.readFeatures(featurecollection, {
                dataProjection: sceneContext.mapCrs, featureProjection: sceneContext.mapCrs
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
        if (marker) {
            const scenePos = marker.geometry.coordinates;
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
                    labelEl.innerText = marker.properties.label;
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

                    sceneContext.eventDispatcher.addEventListener('cameraChanged', scaleSearchMarker);
                    searchMarker.addEventListener('removed', () => {
                        sceneContext.eventDispatcher.removeEventListener('cameraChanged', scaleSearchMarker);
                        // The label DOM element is not removed when the searchMarker group is removed from the instance
                        labelEl.parentNode?.removeChild?.(labelEl);
                    });
                });
            });
        }

    };
    zoomToExtent = (bounds, crs, zoomOffset, minScale, maxScale) => {
        let mapBounds = CoordinatesUtils.reprojectBbox(bounds, crs, this.props.sceneContext.mapCrs);
        // Adjust bounds so that we do not zoom further than 1:searchMinScaleDenom
        const bbWidth = mapBounds[2] - mapBounds[0];
        const bbHeight = mapBounds[3] - mapBounds[1];
        const sceneRect = this.props.sceneContext.scene.viewport.getBoundingClientRect();
        // Compute maximum allowed dimensions at the given scale
        const px2m = 0.0254 / 96;
        const minWidth = sceneRect.width * px2m * maxScale;
        const minHeight = sceneRect.height * px2m * maxScale;
        const scaleFactor = Math.max(bbWidth / minWidth, bbHeight / minHeight);
        if (scaleFactor < 1) {
            const bbCenterX = 0.5 * (mapBounds[0] + mapBounds[2]);
            const bbCenterY = 0.5 * (mapBounds[1] + mapBounds[3]);
            mapBounds = [
                bbCenterX - minWidth / 2, bbCenterY - minHeight / 2,
                bbCenterX + minWidth / 2, bbCenterY + minHeight / 2
            ];
        }

        this.props.sceneContext.setViewToExtent(mapBounds, 0);
    };
}

export default connect((state) => ({
    theme: state.theme.current
}))(SearchField3D);

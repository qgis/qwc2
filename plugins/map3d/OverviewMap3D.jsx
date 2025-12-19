/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import OverviewMapButton from '../../components/OverviewMapButton';


/**
 * Overview map for the 3D map.
*/
export default class OverviewMap3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        center: null,
        resolution: null,
        coneAngle: null
    };
    componentDidMount() {
        this.props.sceneContext.scene.view.controls.addEventListener('change', this.updateViewCone);
    }
    componentWillUnmount() {
        this.props.sceneContext.scene.view.controls.removeEventListener('change', this.updateViewCone);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.sceneContext.mapCrs !== prevProps.sceneContext.mapCrs) {
            this.setupView();
        }
    }
    render() {
        const baseLayer = this.props.sceneContext.baseLayers.find(l => l.visibility === true);
        const overviewLayer = this.props.sceneContext.baseLayers.find(l => l.overview === true) ?? baseLayer;
        return overviewLayer ? (
            <OverviewMapButton
                center={this.state.center} coneRotation={this.state.coneAngle}
                layer={overviewLayer} projection={this.props.sceneContext.mapCrs}
                resolution={this.state.resolution}
            />
        ) : null;
    }
    updateViewCone = () => {
        const scene = this.props.sceneContext.scene;
        const x = scene.view.camera.position.x;
        const y = scene.view.camera.position.y;
        const azimuth = scene.view.controls?.getAzimuthalAngle?.() ?? 0;
        const cameraHeight = scene.view.camera.position.z;
        const resolution = cameraHeight / 100;
        this.setState({
            center: [x, y],
            resolution: resolution,
            coneAngle: -azimuth
        });
    };
}

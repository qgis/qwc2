/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import CoordinatesUtils from '../../utils/CoordinatesUtils';

import './style/BottomBar3D.css';

export default class BottomBar3D extends React.Component {
    static propTypes = {
        cursorPosition: PropTypes.array,
        sceneContext: PropTypes.object
    };
    state = {
        progress: 0
    };
    componentDidUpdate(prevProps) {
        if (this.props.sceneContext.scene && this.props.sceneContext.scene !== prevProps.sceneContext.scene) {
            this.props.sceneContext.scene.addEventListener("update-end", () => {
                this.setState({progress: Math.round(this.props.sceneContext.scene.progress * 100) + "%"});
            });
        }
    }
    render() {
        return (
            <div className="map3d-bottombar">
                <div className="map3d-bottombar-progress">
                    <div className="map3d-bottombar-progressbar" style={{width: this.state.progress}} />
                    <div className="map3d-bottombar-progress-label">{this.state.progress}</div>
                </div>
                <div className="map3d-bottombar-spacer" />
                <div className="map3d-bottombar-position">
                    {(this.props.cursorPosition || []).map(x => x.toFixed(0)).join(" ")}
                </div>
                <div className="map3d-bottombar-projection">
                    {this.props.sceneContext.mapCrs ? CoordinatesUtils.getAvailableCRS()[this.props.sceneContext.mapCrs].label : ""}
                </div>
                <div className="map3d-bottombar-spacer" />
            </div>
        );
    }
}

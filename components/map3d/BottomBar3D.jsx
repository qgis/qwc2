/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {Raycaster, Vector2} from 'three';

import {setBottombarHeight} from '../../actions/map';
import CoordinatesUtils from '../../utils/CoordinatesUtils';

import './style/BottomBar3D.css';


class BottomBar3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        setBottombarHeight: PropTypes.func
    };
    state = {
        cursorPosition: null,
        progress: 0
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('mousemove', this.getCursorPosition);
        this.props.sceneContext.scene.addEventListener("update-end", () => {
            this.setState({progress: Math.round(this.props.sceneContext.scene.progress * 100) + "%"});
        });
    }
    render() {
        return (
            <div className="map3d-bottombar" ref={this.storeHeight}>
                <div className="map3d-bottombar-progress">
                    <div className="map3d-bottombar-progressbar" style={{width: this.state.progress}} />
                    <div className="map3d-bottombar-progress-label">{this.state.progress}</div>
                </div>
                <div className="map3d-bottombar-spacer" />
                <div className="map3d-bottombar-position">
                    {(this.state.cursorPosition || []).map(x => x.toFixed(0)).join(" ")}
                </div>
                <div className="map3d-bottombar-projection">
                    {this.props.sceneContext.mapCrs ? CoordinatesUtils.getAvailableCRS()[this.props.sceneContext.mapCrs].label : ""}
                </div>
                <div className="map3d-bottombar-spacer" />
            </div>
        );
    }
    getCursorPosition = (ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        // Normalize mouse position (-1 to +1)
        const mouse = new Vector2();
        mouse.x = (x / rect.width) * 2 - 1;
        mouse.y = -(y / rect.height) * 2 + 1;

        const raycaster = new Raycaster();
        const camera = this.props.sceneContext.scene.view.camera;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(this.props.sceneContext.scene.scene.children, true);

        if (intersects.length > 0) {
            const p = intersects[0].point;
            this.setState({cursorPosition: [p.x, p.y, p.z]});
        }
    };
    storeHeight = (el) => {
        if (el) {
            this.props.setBottombarHeight(el.clientHeight);
        }
    };
}

export default connect(() => {}, {
    setBottombarHeight: setBottombarHeight
})(BottomBar3D);

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

import {setBottombarHeight} from '../../actions/windows';
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
        this.props.sceneContext.scene.viewport.addEventListener('mousemove', this.scheduleGetCursorPosition);
        this.props.sceneContext.scene.addEventListener("update-end", () => {
            this.setState({progress: Math.round(this.props.sceneContext.scene.progress * 100) + "%"});
        });
    }
    componentWillUnmount() {
        clearTimeout(this.cursorPositionTimeout);
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
    scheduleGetCursorPosition = (ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width * 2 - 1;
        const y = -(ev.clientY - rect.top) / rect.height * 2 + 1;
        clearTimeout(this.cursorPositionTimeout);
        this.cursorPositionTimeout = setTimeout(() => this.getCursorPosition(x, y), 150);
    };
    getCursorPosition = (x, y) => {
        const intersection = this.props.sceneContext.getSceneIntersection(x, y);
        if (intersection) {
            const p = intersection.point;
            this.setState({cursorPosition: [p.x, p.y, p.z]});
        }
    };
    storeHeight = (el) => {
        if (el) {
            this.props.setBottombarHeight(el.clientHeight);
        }
    };
}

export default connect(() => ({}), {
    setBottombarHeight: setBottombarHeight
})(BottomBar3D);

/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setSwipe} from '../actions/layers';
import Icon from '../components/Icon';
import {MapContainerPortalContext} from '../components/PluginsContainer';

import './style/MapCompare.css';

/**
 * Allows comparing the top layer with the rest of the map.
 *
 * Activated through a checkbox in the LayerTree.
 */
class MapCompare extends React.Component {
    static contextType = MapContainerPortalContext;

    static propTypes = {
        setSwipe: PropTypes.func,
        swipe: PropTypes.number
    };
    render() {
        if (this.props.swipe === null) {
            return null;
        }
        const style = {
            left: this.props.swipe + "%"
        };
        return ReactDOM.createPortal((
            <div id="MapCompare" onPointerDown={this.startDragHandle} style={style} >
                <div className="map-compare-handle">
                    <Icon className="map-compare-handle-icon" icon="triangle-left" />
                    <Icon className="map-compare-handle-icon" icon="triangle-right" />
                </div>
            </div>
        ), this.context);
    }
    startDragHandle = (ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const parentRect = ev.currentTarget.parentElement.getBoundingClientRect();
        const clickOffset = ev.clientX - rect.left;
        const moveHandle = (ev2) => {
            let perc = (ev2.clientX - clickOffset - parentRect.left) / parentRect.width * 100;
            perc = Math.min(100, Math.max(0, perc));
            this.props.setSwipe(perc);
        };
        ev.view.document.body.style.userSelect = 'none';
        ev.view.addEventListener("pointermove", moveHandle);
        ev.view.addEventListener("pointerup", () => {
            ev.view.document.body.style.userSelect = '';
            ev.view.removeEventListener("pointermove", moveHandle);
        }, {once: true});
    };
}

export default connect((state) => ({
    swipe: state.layers.swipe
}), {
    setSwipe: setSwipe
})(MapCompare);

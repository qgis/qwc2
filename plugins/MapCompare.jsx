/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setSwipe} from '../actions/layers';
import Icon from '../components/Icon';

import './style/MapCompare.css';

/**
 * Allows comparing the top layer with the rest of the map.
 *
 * Activated through a checkbox in the LayerTree.
 */
class MapComparePlugin extends React.Component {
    constructor(props) {
        super(props);
        this.clickOffset = 0;
        this.el = null;
    }
    static propTypes = {
        setSwipe: PropTypes.func,
        swipe: PropTypes.number
    };
    render() {
        if (this.props.swipe === null) {
            return null;
        }
        const style = {left: this.props.swipe + "%"};
        return (
            <div id="MapCompare" onMouseDown={this.mouseDragStart} onTouchMove={this.touchDrag} onTouchStart={this.touchDragStart} ref={el => { this.el = el; }} style={style}>
                <span className="map-compare-handle">
                    <Icon className="map-compare-handle-icon" icon="triangle-left" />
                    <Icon className="map-compare-handle-icon" icon="triangle-right" />
                </span>
            </div>
        );
    }
    mouseDragStart = (ev) => {
        if (this.el) {
            const rect = this.el.getBoundingClientRect();
            this.clickOffset = ev.clientX - rect.left;
            document.addEventListener("mousemove", this.mouseDrag);
            document.addEventListener("mouseup", this.mouseDragEnd);
        }
        ev.preventDefault();
        ev.stopPropagation();
    };
    mouseDrag = (ev) => {
        let perc = (ev.clientX - this.clickOffset) / document.body.clientWidth * 100;
        perc = Math.min(100, Math.max(0, perc));
        this.props.setSwipe(perc);
        ev.preventDefault();
        ev.stopPropagation();
    };
    mouseDragEnd = (ev) => {
        document.removeEventListener("mousemove", this.mouseDrag);
        document.removeEventListener("mouseup", this.mouseDragEnd);
        ev.preventDefault();
        ev.stopPropagation();
    };
    touchDragStart = (ev) => {
        if (this.el) {
            const rect = this.el.getBoundingClientRect();
            this.clickOffset = ev.touches[0].clientX - rect.left;
        }
    };
    touchDrag = (ev) => {
        let perc = (ev.touches[0].clientX - this.clickOffset) / document.body.clientWidth * 100;
        perc = Math.min(100, Math.max(0, perc));
        this.props.setSwipe(perc);
    };
}

export default connect((state) => ({
    swipe: state.layers.swipe
}), {
    setSwipe: setSwipe
})(MapComparePlugin);

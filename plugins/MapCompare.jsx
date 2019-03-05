/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {setSwipe} = require('../actions/layers');
const Icon = require('../components/Icon');

require('./style/MapCompare.css');

class MapComparePlugin extends React.Component {
    constructor(props) {
        super(props);
        this.clickOffset = 0;
        this.el = null;
    }
    static propTypes = {
        swipe: PropTypes.number,
        setSwipe: PropTypes.func
    }
    render() {
        if(!this.props.swipe && this.props.swipe !== 0) {
            return null;
        }
        let style = {left: this.props.swipe + "%"};
        return (
            <div ref={el => this.el = el} style={style} id="MapCompare" onMouseDown={this.mouseDragStart} onTouchStart={this.touchDragStart} onTouchMove={this.touchDrag}>
                <span className="map-compare-handle">
                    <Icon className="map-compare-handle-icon" icon="triangle-left" />
                    <Icon className="map-compare-handle-icon" icon="triangle-right" />
                </span>
            </div>
        );
    }
    mouseDragStart = (ev) => {
        if(this.el) {
            let rect = this.el.getBoundingClientRect();
            this.clickOffset = ev.clientX - rect.left;
            document.addEventListener("mousemove", this.mouseDrag);
            document.addEventListener("mouseup", this.mouseDragEnd);
        }
        ev.preventDefault();
        ev.stopPropagation();
    }
    mouseDrag = (ev) => {
        let perc = (ev.clientX - this.clickOffset) / document.body.clientWidth * 100;
        perc = Math.min(100, Math.max(0, perc));
        this.props.setSwipe(perc);
        ev.preventDefault();
        ev.stopPropagation();
    }
    mouseDragEnd = (ev) => {
        document.removeEventListener("mousemove", this.mouseDrag);
        document.removeEventListener("mouseup", this.mouseDragEnd);
        ev.preventDefault();
        ev.stopPropagation();
    }
    touchDragStart = (ev) => {
        if(this.el) {
            let rect = this.el.getBoundingClientRect();
            this.clickOffset = ev.touches[0].clientX - rect.left;
        }
    }
    touchDrag = (ev) => {
        let perc = (ev.touches[0].clientX - this.clickOffset) / document.body.clientWidth * 100;
        perc = Math.min(100, Math.max(0, perc));
        this.props.setSwipe(perc);
    }
};


module.exports = {
    MapComparePlugin: connect((state) => ({
        swipe: state.layers.swipe
    }), {
        setSwipe: setSwipe
    })(MapComparePlugin)
};

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
const {Glyphicon} = require('react-bootstrap');
const {setSwipe} = require('../actions/map');

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
        if(!this.props.swipe) {
            return null;
        }
        let style = {left: this.props.swipe + "%"};
        return (
            <div ref={el => this.el = el} style={style} id="MapCompare" onMouseDown={this.dragStart}>
                <span className="map-compare-handle">
                    <Glyphicon className="map-compare-handle-icon" glyph="triangle-left" />
                    <Glyphicon className="map-compare-handle-icon" glyph="triangle-right" />
                </span>
            </div>
        );
    }
    dragStart = (ev) => {
        if(this.el) {
            let rect = this.el.getBoundingClientRect();
            this.clickOffset = ev.clientX - rect.left;
            document.addEventListener("mousemove", this.drag);
            document.addEventListener("mouseup", this.dragEnd);
        }
        ev.preventDefault();
        ev.stopPropagation();
    }
    drag = (ev) => {
        let perc = (ev.clientX - this.clickOffset) / document.body.clientWidth * 100;
        perc = Math.min(100, Math.max(0, perc));
        this.props.setSwipe(perc);
        ev.preventDefault();
        ev.stopPropagation();
    }
    dragEnd = (ev) => {
        document.removeEventListener("mouseup", this.dragEnd);
        document.removeEventListener("mousemove", this.drag);
        ev.preventDefault();
        ev.stopPropagation();
    }
};


module.exports = {
    MapComparePlugin: connect((state) => ({
        swipe: state.map && state.map.swipe || null
    }), {
        setSwipe: setSwipe
    })(MapComparePlugin)
};

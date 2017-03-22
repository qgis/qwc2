/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const assign = require('object-assign');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const MapUtils = require('../../MapStore2/web/client/utils/MapUtils');
require('./style/PrintFrame.css');

const PrintFrame = React.createClass({
    propTypes: {
        map: React.PropTypes.object.isRequired,
        fixedFrame: React.PropTypes.shape({
            width: React.PropTypes.number, // in meters
            height: React.PropTypes.number // in meters
        }),
        bboxSelected: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            fixedFrame: null,
            bboxSelected: () => {}
        }
    },
    getInitialState() {
        return {x: 0, y: 0, width: 0, height: 0, moving: false};
    },
    componentDidMount() {
        this.recomputeBox(this.props, {});
    },
    componentWillReceiveProps(newProps) {
        this.recomputeBox(newProps, this.props);
    },
    recomputeBox(newProps, oldProps) {
        if(newProps.fixedFrame) {
            let getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
            let newState = this.getInitialState();
            let cosa = Math.cos(-newProps.map.bbox.rotation);
            let sina = Math.sin(-newProps.map.bbox.rotation);
            let center = CoordinatesUtils.reproject(newProps.map.center, newProps.map.center.crs, newProps.map.projection);
            let {width, height} = MapUtils.transformExtent(newProps.map.projection, center, newProps.fixedFrame.width, newProps.fixedFrame.height);
            let mapp1 = [center.x - .5 * width * cosa - .5 * height * sina,
                         center.y + .5 * width * sina - .5 * height * cosa];
            let mapp2 = [center.x + .5 * width * cosa + .5 * height * sina,
                         center.y - .5 * width * sina + .5 * height * cosa];
            let pixp1 = getPixelFromCoordinate(mapp1);
            let pixp2 = getPixelFromCoordinate(mapp2);
            newState = {
                x: Math.min(pixp1[0], pixp2[0]),
                y: Math.min(pixp1[1], pixp2[1]),
                width: Math.abs(pixp2[0]- pixp1[0]),
                height: Math.abs(pixp2[1]- pixp1[1])
            };
            this.setState(newState);
        }
    },
    render() {
        let boxStyle = {
            left: this.state.x + 'px',
            top: this.state.y + 'px',
            width: this.state.width + 'px',
            height: this.state.height + 'px',
            lineHeight: this.state.height + 'px',
        };
        if(this.props.fixedFrame) {
            return (
                <div id="PrintFrame" style={boxStyle}></div>
            );
        } else {
            return (
                <div id="PrintFrameEventLayer"
                    onMouseDown={this.startSelection}
                    onMouseMove={this.updateSelection}
                    onMouseUp={this.endSelection}
                    onTouchStart={(ev) => this.startSelection(ev.changedTouches[0])}
                    onTouchMove={(ev) => this.updateSelection(ev.changedTouches[0])}
                    onTouchEnd={(ev) => this.endSelection(ev.changedTouches[0])}>
                    <div id="PrintFrame" style={boxStyle}>
                        <span className="size-box">{this.state.width + " x " + this.state.height}</span>
                    </div>
                </div>
            );
        }
    },
    startSelection(ev) {
        let x = Math.round(ev.clientX);
        let y = Math.round(ev.clientY);
        this.setState({
            x: x,
            y: y,
            width: 0,
            height: 0,
            moving: true
        });
    },
    updateSelection(ev) {
        if(this.state.moving) {
            let x = Math.round(ev.clientX);
            let y = Math.round(ev.clientY);
            let width = Math.round(Math.max(0, x - this.state.x));
            let height = Math.round(Math.max(0, y - this.state.y));
            this.setState({
                width: width,
                height: height
            });
        }
    },
    endSelection(ev) {
        this.setState({moving: false});
        let getCoordinateFromPixel = MapUtils.getHook(MapUtils.GET_COORDINATES_FROM_PIXEL_HOOK);
        let p1 = getCoordinateFromPixel([this.state.x, this.state.y]);
        let p2 = getCoordinateFromPixel([this.state.x + this.state.width, this.state.y + this.state.height]);
        let bbox = {
            minx: Math.min(p1[0], p2[0]),
            miny: Math.min(p1[1], p2[1]),
            maxx: Math.max(p1[0], p2[0]),
            maxy: Math.max(p1[1], p2[1]),
            crs: this.props.map.projection
        }
        if(bbox.minx !== bbox.maxx && bbox.miny !== bbox.maxy) {
            this.props.bboxSelected(bbox, [this.state.width, this.state.height]);
        }
    }
});

module.exports = PrintFrame;

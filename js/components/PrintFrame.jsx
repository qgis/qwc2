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
        map: React.PropTypes.object,
        scale: React.PropTypes.number,
        widthmm: React.PropTypes.number,
        heightmm: React.PropTypes.number,
        interactive: React.PropTypes.bool,
        bboxSelected: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            map: null,
            scale: 0,
            widthmm: 0,
            heightmm: 0,
            interactive: false,
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
        if(!newProps.interactive) {
            let getPixelFromCoordinate = MapUtils.getHook(MapUtils.GET_PIXEL_FROM_COORDINATES_HOOK);
            let newState = this.getInitialState();
            let angle = -newProps.map.bbox.rotation;
            let cosa = Math.cos(angle);
            let sina = Math.sin(angle);

            let mapProj = newProps.map.projection;
            let center = CoordinatesUtils.reproject(newProps.map.center, newProps.map.center.crs, mapProj);
            let width = newProps.scale * newProps.widthmm / 1000.;
            let height = newProps.scale * newProps.heightmm / 1000.;
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
            height: this.state.height + 'px'
        };
        if((this.state.width !== 0 || this.state.height !== 0) && !this.props.interactive) {
            return (
                <div id="PrintFrame" style={boxStyle}></div>
            );
        } else if(this.props.interactive) {
            return (
                <div id="PrintFrameEventLayer" onMouseDown={this.startSelection} onMouseMove={this.updateSelection} onMouseUp={this.endSelection}>
                    <div id="PrintFrame" style={boxStyle}></div>
                </div>
            );
        }
        return null;
    },
    startSelection(ev) {
        let x = ev.clientX;
        let y = ev.clientY;
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
            let x = ev.clientX;
            let y = ev.clientY;
            let width = Math.max(0, x - this.state.x);
            let height = Math.max(0, y - this.state.y);
            this.setState({
                width: width,
                height: height
            });
        }
    },
    endSelection(ev) {
        this.setState({
            moving: false
        })
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
            this.props.bboxSelected(bbox);
        }
    }
});

module.exports = PrintFrame;

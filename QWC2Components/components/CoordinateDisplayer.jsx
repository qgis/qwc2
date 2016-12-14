/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const proj4js = require('proj4');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');

const CoordinateDisplayer = React.createClass({
    propTypes: {
        mousepos: React.PropTypes.object,
        diplaycrs: React.PropTypes.string
    },
    render() {
        let {x, y} = CoordinatesUtils.reproject([this.props.mousepos.x, this.props.mousepos.y], this.props.mousepos.crs, this.props.displaycrs);
        let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 4 : 0;
        return (
            <input type="text" className="coordinatedisplayer"
                value={x.toFixed(digits) + " " + y.toFixed(digits)}
                readOnly="readOnly"/>
        )
    }
});

const selector = (state) => {
    let mousepos = state && state.mousePosition && state.mousePosition.position ? state.mousePosition.position : {};
    return  {
        mousepos: {x: mousepos.x || 0, y: mousepos.y || 0, crs: mousepos.crs || "EPSG:4326"},
    };
};
module.exports = {
    CoordinateDisplayer: connect(selector)(CoordinateDisplayer)
};

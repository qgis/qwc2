/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const proj4js = require('proj4');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');

class CoordinateDisplayer extends React.Component {
    static propTypes = {
        mousepos: PropTypes.object,
        diplaycrs: PropTypes.string
    }
    render() {
        let value = "";
        if(this.props.mousepos) {
            let {x, y} = CoordinatesUtils.reproject([this.props.mousepos.lng, this.props.mousepos.lat], "EPSG:4326", this.props.displaycrs);
            let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 4 : 0;
            value = x.toFixed(digits) + " " + y.toFixed(digits);
        }
        return (
            <input type="text" className="coordinatedisplayer" value={value} readOnly="readOnly"/>
        )
    }
};

const selector = (state) => {
    return  {
        mousepos: state.mousePosition && state.mousePosition.position ? state.mousePosition.position.latlng : undefined,
    };
};
module.exports = {
    CoordinateDisplayer: connect(selector)(CoordinateDisplayer)
};

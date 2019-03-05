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
const proj4js = require('proj4').default;
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const LocaleUtils = require('../utils/LocaleUtils');

class CoordinateDisplayer extends React.Component {
    static propTypes = {
        displaycrs: PropTypes.string,
        mapcrs: PropTypes.string,
        coordinate: PropTypes.object,
        className: PropTypes.string
    }
    render() {
        let value = "";
        if(this.props.mousepos) {
            let coo = CoordinatesUtils.reproject(this.props.mousepos.coordinate, this.props.mapcrs, this.props.displaycrs);
            if(!isNaN(coo[0]) && !isNaN(coo[1])) {
                let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 4 : 0;
                value = LocaleUtils.toLocaleFixed(coo[0], digits) + " " + LocaleUtils.toLocaleFixed(coo[1], digits);
            }
        }
        return (
            <input type="text" className={this.props.className} value={value} readOnly="readOnly"/>
        )
    }
};

const selector = state => ({
    mapcrs: state.map.projection,
    mousepos: state.mousePosition && state.mousePosition.position && state.mousePosition.position || undefined,
});

module.exports = {
    CoordinateDisplayer: connect(selector)(CoordinateDisplayer)
};

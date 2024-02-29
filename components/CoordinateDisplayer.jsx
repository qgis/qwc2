/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';

class CoordinateDisplayer extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        coordinate: PropTypes.object,
        displaycrs: PropTypes.string,
        mapcrs: PropTypes.string,
        mousepos: PropTypes.object
    };
    render() {
        let value = "";
        if (this.props.mousepos) {
            const coo = CoordinatesUtils.reproject(this.props.mousepos.coordinate, this.props.mapcrs, this.props.displaycrs);
            if (!isNaN(coo[0]) && !isNaN(coo[1])) {
                const digits = CoordinatesUtils.getUnits(this.props.displaycrs) === 'degrees' ? 4 : 0;
                value = LocaleUtils.toLocaleFixed(coo[0], digits) + " " + LocaleUtils.toLocaleFixed(coo[1], digits);
            }
        }
        return (
            <input className={this.props.className} readOnly="readOnly" type="text" value={value}/>
        );
    }
}

const selector = state => ({
    mapcrs: state.map.projection,
    mousepos: state.mousePosition.position
});

export default connect(selector)(CoordinateDisplayer);

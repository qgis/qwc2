/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

export default class CoordinateDisplayer extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        coordinateFormatter: PropTypes.func,
        displayCrs: PropTypes.string,
        mapCrs: PropTypes.string
    };
    state = {
        mousePos: []
    };
    componentDidMount() {
        MapUtils.getHook(MapUtils.ADD_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    componentWillUnmount() {
        MapUtils.getHook(MapUtils.REMOVE_POINTER_MOVE_LISTENER)(this.getMapMousePos);
    }
    render() {
        let value = "";
        const coo = CoordinatesUtils.reproject(this.state.mousePos, this.props.mapCrs, this.props.displayCrs);
        if (this.props.coordinateFormatter) {
            value = this.props.coordinateFormatter(coo, this.props.displayCrs);
        } else if (!isNaN(coo[0]) && !isNaN(coo[1])) {
            const decimals = CoordinatesUtils.getPrecision(this.props.displayCrs);
            value = LocaleUtils.toLocaleFixed(coo[0], decimals) + " " + LocaleUtils.toLocaleFixed(coo[1], decimals);
        }
        return (
            <input className={this.props.className} readOnly="readOnly" type="text" value={value}/>
        );
    }
    getMapMousePos = (ev) => {
        this.setState({mousePos: ev.coordinate});
    };
}

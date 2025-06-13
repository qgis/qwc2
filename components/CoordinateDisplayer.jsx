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
        displayCrs: PropTypes.string,
        mapCrs: PropTypes.string,
    };
    state = {
        mousePos: []
    };
    componentDidMount() {
        MapUtils.getHook(MapUtils.GET_MAP).on('pointermove', this.getMapMousePos);
    }
    componentWillUnmount() {
        MapUtils.getHook(MapUtils.GET_MAP).un('pointermove', this.getMapMousePos);
    }
    render() {
        let value = "";
        if (this.state.mousePos.length === 2) {
            value = CoordinatesUtils.getFormattedCoordinate(
                this.state.mousePos,
                this.props.mapCrs,
                this.props.displayCrs
            );
        }
        return (
            <input className={this.props.className} readOnly type="text" value={value} />
        );
    }
    getMapMousePos = (ev) => {
        this.setState({ mousePos: ev.coordinate });
    };
}

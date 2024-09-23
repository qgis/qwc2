/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import './style/ScaleBarSupport.css';


/**
 * Scalebar support for the map component.
 */
class ScaleBarSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        mapMargins: PropTypes.object,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_ScaleLine-ScaleLine.html) */
        options: PropTypes.object
    };
    static defaultOpt = {
        minWidth: 64,
        units: 'metric'
    };
    constructor(props) {
        super(props);
        this.scalebar = null;
    }
    componentWillUnmount = () => {
        if (this.scalebar) {
            this.props.map.removeControl(this.scalebar);
        }
        document.getElementById("PluginsContainer").removeChild(this.scalebarContainer);
    };
    initScaleBar = (el) => {
        this.scalebar = new ol.control.ScaleLine({
            target: el,
            ...ScaleBarSupport.defaultOpt,
            ...this.props.options
        });
        this.props.map.addControl(this.scalebar);
    };
    render() {
        const style = this.props.mapMargins.splitTopAndBottomBar ? {
            marginLeft: this.props.mapMargins.left + 'px'
        } : {};
        return (
            <div id="ScaleBar" ref={this.initScaleBar} style={style} />
        );
    }
}

export default connect((state) => ({
    mapMargins: state.windows.mapMargins
}))(ScaleBarSupport);

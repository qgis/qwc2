/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ol from 'openlayers';
import PropTypes from 'prop-types';

export default class ScaleBarSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        // See https://openlayers.org/en/latest/apidoc/ol.control.ScaleLine.html
        options: PropTypes.object
    };
    static defaultOpt = {
        minWidth: 64,
        units: 'metric'
    };
    constructor(props) {
        super(props);
        this.scalebar = new ol.control.ScaleLine({
            ...ScaleBarSupport.defaultOpt,
            ...props.options
        });
    }
    componentDidMount() {
        this.scalebarContainer = document.createElement("div");
        this.scalebarContainer.id = this.props.map.get('id') + "-scalebar";
        document.getElementById("PluginsContainer").appendChild(this.scalebarContainer);
        this.scalebar.setTarget(this.props.map.get('id') + "-scalebar");
        this.props.map.addControl(this.scalebar);
    }
    componentWillUnmount = () => {
        document.getElementById("PluginsContainer").removeChild(this.scalebarContainer);
    };
    render() {
        return null;
    }
}

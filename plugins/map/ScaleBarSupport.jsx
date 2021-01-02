/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import ol from 'openlayers';

export default class ScaleBarSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        // See https://openlayers.org/en/latest/apidoc/ol.control.ScaleLine.html
        options: PropTypes.object
    }
    static defaultOpt = {
        minWidth: 64,
        units: 'metric'
    }
    constructor(props) {
        super(props);
        this.scalebar = new ol.control.ScaleLine({...ScaleBarSupport.defaultOpt, ...props.options});
        props.map.addControl(this.scalebar);
    }
    render() {
        return null;
    }
}

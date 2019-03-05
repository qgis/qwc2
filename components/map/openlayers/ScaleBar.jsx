/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const ol = require('openlayers');

class ScaleBar extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        // See https://openlayers.org/en/latest/apidoc/ol.control.ScaleLine.html
        options: PropTypes.object
    }
    static defaultProps = {
        map: null,
        options: {}
    }
    static defaultOpt = {
        minWidth: 64,
        units: 'metric'
    }
    componentDidMount() {
        this.scalebar = new ol.control.ScaleLine(assign({}, ScaleBar.defaultOpt, this.props.options));
        if (this.props.map) {
            this.props.map.addControl(this.scalebar);
        }
    }
    render() {
        return null;
    }
};

module.exports = ScaleBar;

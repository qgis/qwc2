/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import ol from 'openlayers';
import assign from 'object-assign';
import {LayerRole} from '../../actions/layers';
import Layer from '../../components/map/openlayers/Layer';

import './style/OverviewSupport.css';

class OverviewMap extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        // See https://openlayers.org/en/latest/apidoc/ol.control.OverviewMap.html
        options: PropTypes.object,
        projection: PropTypes.string
    }
    constructor(props) {
        super(props);
        const opt = assign({
            className: "overview-map",
            collapseLabel: '\u00BB',
            label: '\u00AB',
            collapsed: true,
            collapsible: true
        }, props.options);
        this.overview = new ol.control.OverviewMap(opt);
        props.map.addControl(this.overview);
        this.overview.getOverviewMap().set('id', 'overview');
    }
    render() {
        const layer = this.props.layers.find(layer => layer.role === LayerRole.BACKGROUND && layer.visibility);
        if (layer) {
            return (
                <Layer key={layer.uuid} map={this.overview.getOverviewMap()} options={layer} projection={this.props.projection} />
            );
        }
        return null;
    }
}

export default connect((state) => ({
    layers: state.layers.flat,
    projection: state.map.projection
}), {})(OverviewMap);

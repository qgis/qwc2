/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {addLayer, removeLayer, changeLayerProperties} = require('../../MapStore2Components/actions/layers');

class SelectionLayer extends React.Component {
    static propTypes = {
        layerid: PropTypes.string.isRequired,
        title: PropTypes.string,
        featuresCrs: PropTypes.string
        features: PropTypes.array,
        addLayer: PropTypes.func,
        removeLayer: PropTypes.func
    }
    static defaultProps = {
        title: "Selection",
        featuresCrs: "EPSG:3857"
    }
    componentWillReceiveProps(newProps) {
        if(newProps.features !== this.props.features) {
            if(!newProps.features && this.props.features) {
                newProps.removeLayer(this.props.layerid);
            } else if(newProps.features && !this.props.features) {
                let layer = {
                    id: newProps.layerid,
                    name: newProps.layerid,
                    title: newProps.title,
                    type: "vector",
                    features: newProps.features,
                    featuresCrs: newProps.featuresCrs,
                    visibility: true
                };
                newProps.addLayer(layer, true);
            } else {
                let newlayerprops = {
                    visibility: true,
                    features: newProps.features
                };
                newProps.changeLayerProperties(newProps.layerid, newlayerprops);
            }
        }
    }
    render() {
        return null;
    }
};

module.exports = {
    SelectionLayer: connect((state) => {}, {
        addLayer: addLayer,
        removeLayer: removeLayer,
        changeLayerProperties: changeLayerProperties
    })(SelectionLayer)
};

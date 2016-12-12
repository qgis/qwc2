/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {addLayer, removeLayer, changeLayerProperties} = require('../../MapStore2/web/client/actions/layers');

const SelectionLayer = React.createClass({
    propTypes: {
        layerid: React.PropTypes.string.isRequired,
        title: React.PropTypes.string,
        featuresCrs: React.PropTypes.string
        features: React.PropTypes.array,
        addLayer: React.PropTypes.func,
        removeLayer: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            title: "Selection",
            featuresCrs: "EPSG:3857"
        }
    }
    componentWillMount() {
        componentWillMount(this.props);
    },
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
    },
    render() {
        return null;
    }
});

module.exports = {
    SelectionLayer: connect((state) => {}, {
        addLayer: addLayer,
        removeLayer: removeLayer,
        changeLayerProperties: changeLayerProperties
    })(SelectionLayer)
};

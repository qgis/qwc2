/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const {addLayer,LayerRole} = require('../actions/layers');
const LayerUtils = require('../utils/LayerUtils');
const ServiceLayerUtils = require('../utils/ServiceLayerUtils');

class API extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func
    }
    componentDidMount() {
        window.qwc2 = {};
        window.qwc2.addExternalLayer = this.addExternalLayer
    }
    render() {
        return null;
    }
    addExternalLayer = (resource) => {
        let params = LayerUtils.splitLayerUrlParam(resource);
        ServiceLayerUtils.findLayers(params.type, params.url, [params], (source, layer) => {
            if(layer) {
                this.props.addLayer(assign({
                    id: layer.name + Date.now().toString(),
                    role: LayerRole.USERLAYER
                }, layer, {sublayers: null}));
            }
        });
    }
};

module.exports = module.exports = {
    APIPlugin: connect(state => ({}), {
        addLayer: addLayer
    })(API)
};

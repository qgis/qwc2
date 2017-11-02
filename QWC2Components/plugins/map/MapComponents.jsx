/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');

const {clickOnMap} = require('../../../MapStore2/web/client/actions/map');
const {changeMapView} = require('../../actions/map');
const {layerLoading, layerLoad, layerError, invalidLayer} = require('../../../MapStore2/web/client/actions/layers');
const {changeMousePosition} = require('../../../MapStore2/web/client/actions/mousePosition');


// Map
const Map = connect((state) => ({
    mousePosition: state.mousePosition || {enabled: false}
}), {
    onMapViewChanges: changeMapView,
    onClick: clickOnMap,
    onMouseMove: changeMousePosition,
    onLayerLoading: layerLoading,
    onLayerLoad: layerLoad,
    onLayerError: layerError,
    onInvalidLayer: invalidLayer
}, (stateProps, dispatchProps, ownProps) => {
    return assign({}, ownProps, stateProps, assign({}, dispatchProps, {
        onMouseMove: stateProps.mousePosition.enabled ? dispatchProps.onMouseMove : () => {}
    }));
})(require('../../../MapStore2/web/client/components/map/openlayers/Map'));

// Map layer plugins
require('../../../MapStore2/web/client/components/map/openlayers/plugins/index');

module.exports = {
    Map: Map,
    Layer: require('../../../MapStore2/web/client/components/map/openlayers/Layer'),
    Feature: require('../../../MapStore2/web/client/components/map/openlayers/Feature')
};

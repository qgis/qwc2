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

const {clickOnMap} = require('../../../MapStore2Components/actions/map');
const {changeMapView} = require('../../actions/map');
const {layerLoading, layerLoad, layerError, invalidLayer} = require('../../actions/layers');
const {changeMousePosition} = require('../../../MapStore2Components/actions/mousePosition');


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
})(require('../../../MapStore2Components/components/map/openlayers/Map'));

module.exports = {
    Map: Map,
    Layer: require('../../../MapStore2Components/components/map/openlayers/Layer'),
    Feature: require('../../../MapStore2Components/components/map/openlayers/Feature')
};

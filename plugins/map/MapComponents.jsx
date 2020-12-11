/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const {connect} = require('react-redux');

const {changeMapView, clickOnMap, clickFeatureOnMap} = require('../../actions/map');
const {setLayerLoading} = require('../../actions/layers');
const {changeMousePositionState} = require('../../actions/mousePosition');
const {setCurrentTask} = require('../../actions/task');


const Map = connect((state) => ({
    trackMousePos: state.mousePosition.enabled || false,
    identifyEnabled: state.identify && state.identify.enabled ? true : false,
    unsetTaskOnMapClick: state.task && state.task.unsetOnMapClick
}), {
    onMapViewChanges: changeMapView,
    onClick: clickOnMap,
    onFeatureClick: clickFeatureOnMap,
    onMouseMove: changeMousePositionState,
    setLayerLoading: setLayerLoading,
    setCurrentTask: setCurrentTask
})(require('../../components/map/openlayers/Map'));

module.exports = {
    Map: Map,
    Layer: require('../../components/map/openlayers/Layer')
};

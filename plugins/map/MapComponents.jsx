/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import {connect} from 'react-redux';
import {changeMapView, clickOnMap, clickFeatureOnMap} from '../../actions/map';
import {setLayerLoading} from '../../actions/layers';
import {changeMousePositionState} from '../../actions/mousePosition';
import {setCurrentTask} from '../../actions/task';
import olLayer from '../../components/map/openlayers/Layer';
import olMap from '../../components/map/openlayers/Map';


export const Map = connect((state) => ({
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
})(olMap);

export const Layer = olLayer;

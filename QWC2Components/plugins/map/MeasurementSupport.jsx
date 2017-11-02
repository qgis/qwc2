/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const {connect} = require('react-redux');
const {changeMeasurementState} = require('../../../MapStore2/web/client/actions/measurement');

module.exports = connect((state) => ({
    measurement: state.measurement || {},
    updateOnMouseMove: true
}), {
    changeMeasurementState
})(require('../../../MapStore2/web/client/components/map/openlayers/MeasurementSupport'));

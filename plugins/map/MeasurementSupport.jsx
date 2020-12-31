/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import {connect} from 'react-redux';
import {changeMeasurementState} from '../../actions/measurement';
import olMeasurementSupport from '../../components/map/openlayers/MeasurementSupport';

export default connect((state) => ({
    measurement: state.measurement || {}
}), {
    changeMeasurementState
})(olMeasurementSupport);

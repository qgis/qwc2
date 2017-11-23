/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const {connect} = require('react-redux');
const {changeDrawingStatus, endDrawing, setCurrentStyle} = require('../../../MapStore2Components/actions/draw');

module.exports = connect((state) => (
    state.draw || {}
), {
    onChangeDrawingStatus: changeDrawingStatus,
    onEndDrawing: endDrawing,
    setCurrentStyle: setCurrentStyle
})(require('../../../MapStore2Components/components/map/openlayers/DrawSupport'));

/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const {connect} = require('react-redux');
const {changeLocateState, onLocateError} = require('../../actions/locate');

module.exports = connect((state) => ({
    status: state.locate && state.locate.state,
    messages: state.locale && state.locale.messages ? state.locale.messages.locate : undefined
}), {
    changeLocateState,
    onLocateError
})(require('../../components/map/openlayers/Locate'));

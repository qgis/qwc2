/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const {connect} = require('react-redux');
const {updateHighlighted} = require('../../../MapStore2Components/actions/highlight');

module.exports = connect((state) => (
    state.highlight || {}
), {
    updateHighlighted
})(require('../../../MapStore2Components/components/map/openlayers/HighlightFeatureSupport'));

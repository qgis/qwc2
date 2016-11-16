/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const {connect} = require('react-redux');
const {changeLocateState} = require('../../MapStore2/web/client/actions/locate');
require('./style/Buttons.css');

const locateSelector = (state) => ({
    locate: state.locate && state.locate.state || 'DISABLED',
    id: "LocateBtn"
});

module.exports = {
    LocateButtonPlugin: connect(locateSelector, {
        onClick: changeLocateState
    })(require('../../MapStore2/web/client/components/mapcontrols/locate/LocateBtn')),
    reducers: {locate: require('../../MapStore2/web/client/reducers/locate')}
};

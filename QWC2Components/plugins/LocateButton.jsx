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
const LocateBtn = require('../../MapStore2/web/client/components/mapcontrols/locate/LocateBtn');
require('./style/Buttons.css');

const LocateButton = React.createClass({
    propTypes: {
        locate : React.PropTypes.string,
        position: React.PropTypes.number,
        onClick: React.PropTypes.func
    },
    getDefaultProps() {
        return { position: 2 }
    },
    render() {
        return (<LocateBtn onClick={this.props.onClick} locate={this.props.locate} id="LocateBtn" style={{bottom: (5 + 4 * this.props.position) + 'em'}} />);
    }
});

const locateSelector = (state) => ({
    locate: state.locate && state.locate.state || 'DISABLED',
    id: "LocateBtn"
});

module.exports = {
    LocateButtonPlugin: connect(locateSelector, {
        onClick: changeLocateState
    })(LocateButton),
    reducers: {locate: require('../../MapStore2/web/client/reducers/locate')}
};

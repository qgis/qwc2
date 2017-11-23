/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeLocateState} = require('../../MapStore2Components/actions/locate');
const LocateBtn = require('../../MapStore2Components/components/buttons/LocateBtn');
require('./style/Buttons.css');

class LocateButton extends React.Component {
    static propTypes = {
        locate : PropTypes.string,
        position: PropTypes.number,
        onClick: PropTypes.func
    }
    static defaultProps = {
        position: 2
    }
    render() {
        let tooltip = (<Message msgId={"locate.statustooltip." + this.props.locate} />);
        return (
            <LocateBtn
                onClick={this.props.onClick}
                locate={this.props.locate}
                id="LocateBtn"
                tooltip={tooltip}
                style={{bottom: (5 + 4 * this.props.position) + 'em'}} />
        );
    }
};

const locateSelector = (state) => ({
    locate: state.locate && state.locate.state || 'DISABLED',
    id: "LocateBtn"
});

module.exports = {
    LocateButtonPlugin: connect(locateSelector, {
        onClick: changeLocateState
    })(LocateButton),
    reducers: {locate: require('../../MapStore2Components/reducers/locate')}
};

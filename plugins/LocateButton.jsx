/**
 * Copyright 2015-2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const classnames = require('classnames');
const LocaleUtils = require('../utils/LocaleUtils');
const {changeLocateState} = require('../actions/locate');
const Icon = require('../components/Icon');
const Spinner = require('../components/Spinner');
require('./style/Buttons.css');


class LocateButton extends React.Component {
    static propTypes = {
        locateState: PropTypes.string,
        changeLocateState: PropTypes.func,
        position: PropTypes.number
    }
    static defaultProps = {
        position: 2
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);

        if(!navigator.geolocation) {
            props.changeLocateState("PERMISSION_DENIED");
        } else {
            navigator.geolocation.getCurrentPosition(() => {
                // OK!
            }, (err) => {
                if (err.code === 1) {
                    props.changeLocateState("PERMISSION_DENIED");
                }
            });
        }
    }
    onClick = () => {
        if(this.props.locateState === "DISABLED") {
            this.props.changeLocateState("ENABLED");
        } else if(this.props.locateState === "ENABLED") {
            this.props.changeLocateState("FOLLOWING");
        } else {
            this.props.changeLocateState("DISABLED");
        }
    }
    render = () => {
        let tooltip = LocaleUtils.getMessageById(this.context.messages, "locate.statustooltip." + this.props.locateState);
        let contents = null;
        if(this.props.locateState === "LOCATING") {
            contents = (<Spinner />);
        } else {
            contents = (<Icon icon="screenshot"/>);
        }
        let classes = classnames({
            "map-button": true,
            ["locate-button-" + this.props.locateState]: true
        });
        return (
            <button className={classes}
                onClick={this.onClick} title={tooltip}
                disabled={this.props.locateState === "PERMISSION_DENIED"}
                style={{bottom: (5 + 4 * this.props.position) + 'em'}}
             >
                {contents}
            </button>
        );
    }
};

module.exports = {
    LocateButtonPlugin: connect(state => ({
        locateState: state.locate.state || 'DISABLED'
    }), {
        changeLocateState: changeLocateState
    })(LocateButton),
    reducers: {locate: require('../reducers/locate')}
};

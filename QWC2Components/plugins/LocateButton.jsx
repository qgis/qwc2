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
const Spinner = require('react-spinkit');
const {Glyphicon} = require('react-bootstrap');
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const {changeLocateState} = require('../../MapStore2Components/actions/locate');
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

        navigator.geolocation.getCurrentPosition(() => {
            // OK!
        }, (err) => {
            if (error.code === 1) {
                props.changeLocateState("PERMISSION_DENIED");
            }
        });
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
            contents = (<Spinner style={{display: 'inline-block', width: '1.5em', height: '1.5em'}} name="circle" fadeIn="none" />);
        } else {
            contents = (<Glyphicon glyph="screenshot"/>);
        }
        return (
            <button className={"Button locate-button-" + this.props.locateState}
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
    reducers: {locate: require('../../MapStore2Components/reducers/locate')}
};

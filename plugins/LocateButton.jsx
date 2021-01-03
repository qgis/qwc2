/**
 * Copyright 2015-2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classnames from 'classnames';
import LocaleUtils from '../utils/LocaleUtils';
import {changeLocateState} from '../actions/locate';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import './style/Buttons.css';


class LocateButton extends React.Component {
    static propTypes = {
        changeLocateState: PropTypes.func,
        locateState: PropTypes.string,
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

        if (!navigator.geolocation) {
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
        if (this.props.locateState === "DISABLED") {
            this.props.changeLocateState("ENABLED");
        } else if (this.props.locateState === "ENABLED") {
            this.props.changeLocateState("FOLLOWING");
        } else {
            this.props.changeLocateState("DISABLED");
        }
    }
    render = () => {
        const tooltip = LocaleUtils.getMessageById(this.context.messages, "locate.statustooltip." + this.props.locateState);
        let contents = null;
        if (this.props.locateState === "LOCATING") {
            contents = (<Spinner />);
        } else {
            contents = (<Icon icon="screenshot"/>);
        }
        const classes = classnames({
            "map-button": true,
            ["locate-button-" + this.props.locateState]: true
        });
        return (
            <button className={classes}
                disabled={this.props.locateState === "PERMISSION_DENIED"} onClick={this.onClick}
                style={{bottom: (5 + 4 * this.props.position) + 'em'}}
                title={tooltip}
            >
                {contents}
            </button>
        );
    }
}

export default connect(state => ({
    locateState: state.locate.state
}), {
    changeLocateState: changeLocateState
})(LocateButton);

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


/**
 * Map button for controling the locate (GPS) state.
 */
class LocateButton extends React.Component {
    static propTypes = {
        changeLocateState: PropTypes.func,
        locateState: PropTypes.string,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        splitScreen: PropTypes.object
    };
    static defaultProps = {
        position: 2
    };
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
    };
    render = () => {
        const splitWindows = Object.values(this.props.splitScreen);
        const right = splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0);
        const bottom = splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0);
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(' + bottom + 'px + ' + (5 + 4 * this.props.position) + 'em)'
        };
        const tooltipMsg = {
            DISABLED: LocaleUtils.tr("locate.statustooltip.DISABLED"),
            ENABLED: LocaleUtils.tr("locate.statustooltip.ENABLED"),
            FOLLOWING: LocaleUtils.tr("locate.statustooltip.FOLLOWING"),
            LOCATING: LocaleUtils.tr("locate.statustooltip.LOCATING"),
            PERMISSION_DENIED: LocaleUtils.tr("locate.statustooltip.PERMISSION_DENIED")
        };
        let contents = null;
        if (this.props.locateState === "LOCATING") {
            contents = (<Spinner />);
        } else {
            contents = (<Icon icon="screenshot" title={tooltipMsg[this.props.locateState]}/>);
        }
        const classes = classnames({
            "map-button": true,
            ["locate-button-" + this.props.locateState]: true
        });
        return (
            <button className={classes}
                disabled={this.props.locateState === "PERMISSION_DENIED"} onClick={this.onClick}
                style={style}
                title={tooltipMsg[this.props.locateState]}
            >
                {contents}
            </button>
        );
    };
}

export default connect(state => ({
    locateState: state.locate.state,
    splitScreen: state.windows.splitScreen
}), {
    changeLocateState: changeLocateState
})(LocateButton);

/**
 * Copyright 2015-2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {changeLocateState} from '../actions/locate';
import MapButton from '../components/MapButton';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';


/**
 * Map button for controling the locate (GPS) state.
 */
class LocateButton extends React.Component {
    static propTypes = {
        changeLocateState: PropTypes.func,
        locateState: PropTypes.string,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        theme: PropTypes.object,
        /** Omit the button in themes matching one of these flags. */
        themeFlagBlacklist: PropTypes.arrayOf(PropTypes.string),
        /** Only show the button in themes matching one of these flags. */
        themeFlagWhitelist: PropTypes.arrayOf(PropTypes.string)
    };
    static defaultProps = {
        position: 2
    };
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
        if (!ThemeUtils.themeFlagsAllowed(this.props.theme, this.props.themeFlagWhitelist, this.props.themeFlagBlacklist)) {
            return null;
        }
        const tooltipMsg = {
            DISABLED: LocaleUtils.tr("locate.statustooltip.DISABLED"),
            ENABLED: LocaleUtils.tr("locate.statustooltip.ENABLED"),
            FOLLOWING: LocaleUtils.tr("locate.statustooltip.FOLLOWING"),
            LOCATING: LocaleUtils.tr("locate.statustooltip.LOCATING"),
            PERMISSION_DENIED: LocaleUtils.tr("locate.statustooltip.PERMISSION_DENIED")
        };
        return (
            <MapButton
                active={["LOCATING", "ENABLED"].includes(this.props.locateState)}
                busy={this.props.locateState === "LOCATING"}
                className={"locate-button-" + this.props.locateState}
                disabled={this.props.locateState === "PERMISSION_DENIED"}
                engaged={this.props.locateState === "FOLLOWING"}
                icon="screenshot"
                onClick={this.onClick}
                position={this.props.position}
                title={tooltipMsg[this.props.locateState]}
            />
        );
    };
}

export default connect(state => ({
    locateState: state.locate.state,
    theme: state.theme.current
}), {
    changeLocateState: changeLocateState
})(LocateButton);

/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {changeLocateState, changeLocatePosition, onLocateError} from '../../actions/locate';
import OlLocate from '../../components/map/OlLocate';

class LocateSupport extends React.Component {
    static propTypes = {
        changeLocatePosition: PropTypes.func,
        changeLocateState: PropTypes.func,
        locateState: PropTypes.object,
        map: PropTypes.object,
        onLocateError: PropTypes.func,
        options: PropTypes.object,
        projection: PropTypes.string,
        startupParams: PropTypes.object
    };
    static defaultProps = {
        options: {}
    };
    static defaultOpt = {
        startupMode: "DISABLED", // either "DISABLED", "ENABLED" or "FOLLOWING"
        follow: false, // follow with zoom and pan the user's location
        remainActive: true,
        metric: true,
        stopFollowingOnDrag: false,
        keepCurrentZoomLevel: true,
        locateOptions: {
            maximumAge: 2000,
            enableHighAccuracy: true,
            timeout: 10000,
            maxZoom: 18
        }
    };
    componentDidMount() {
        const options = {...LocateSupport.defaultOpt, ...this.props.options};
        this.locate = new OlLocate(this.props.map, options);
        this.locate.options.onLocationError = this.onLocationError;
        this.locate.on("propertychange", (e) => {this.onPropChange(e.key, e.target.get(e.key)); });
        this.configureLocate(this.props.locateState.state);

        const startupMode = options.startupMode.toUpperCase();
        const highlightCenter = ["true", "1"].includes("" + (this.props.startupParams && this.props.startupParams.hc || "").toLowerCase());
        if (startupMode !== "DISABLED" && !this.props.startupParams.st && !highlightCenter) {
            this.props.changeLocateState(startupMode);
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.locateState.state !== prevProps.locateState.state) {
            this.configureLocate(this.props.locateState.state);
        }
        if (this.props.projection !== prevProps.projection) {
            this.locate.setProjection(this.props.projection);
        }
    }
    configureLocate = (newState) => {
        const state = this.locate.get("state");
        if (newState === "ENABLED" && state === "DISABLED") {
            this.locate.start();
        } else if (newState === "FOLLOWING" && state === "ENABLED") {
            this.locate.startFollow();
        } else if (newState === "FOLLOWING" && state === "DISABLED") {
            this.locate.start();
            this.locate.startFollow();
        } else if (newState === "DISABLED") {
            this.locate.stop();
        }
    };
    onPropChange = (key, value) => {
        if (key === "state" && this.props.locateState.state !== value) {
            this.props.changeLocateState(value);
        } else if (key === "position" && this.props.locateState.position !== value) {
            this.props.changeLocatePosition(value);
        }
    };
    onLocationError = (err) => {
        this.props.onLocateError(err.message);
        // User denied geolocation prompt
        if (err.code === 1) {
            this.props.changeLocateState("PERMISSION_DENIED");
        } else {
            this.props.changeLocateState("DISABLED");
        }
    };
    render() {
        return null;
    }
}

export default connect((state) => ({
    locateState: state.locate,
    startupParams: state.localConfig.startupParams
}), {
    changeLocateState,
    changeLocatePosition,
    onLocateError
})(LocateSupport);

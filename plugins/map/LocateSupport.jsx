/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import OlLocate from '../../components/map/OlLocate';
import {changeLocateState, onLocateError} from '../../actions/locate';

class LocateSupport extends React.Component {
    static propTypes = {
        changeLocateState: PropTypes.func,
        map: PropTypes.object,
        messages: PropTypes.object,
        onLocateError: PropTypes.func,
        options: PropTypes.object,
        projection: PropTypes.string,
        startupParams: PropTypes.object,
        status: PropTypes.string
    }
    static defaultProps = {
        status: "DISABLED",
        changeLocateState: () => {},
        onLocateError: () => {},
        options: {}
    }
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
    }
    componentDidMount() {
        const options = {...LocateSupport.defaultOpt, ...this.props.options};
        this.locate = new OlLocate(this.props.map, options);
        this.locate.setStrings(this.props.messages);
        this.locate.options.onLocationError = this.onLocationError;
        this.locate.on("propertychange", (e) => {this.onStateChange(e.target.get(e.key)); });
        this.configureLocate(this.props.status);

        const startupMode = options.startupMode.toUpperCase();
        const highlightCenter = ["true", "1"].includes("" + (this.props.startupParams && this.props.startupParams.hc || "").toLowerCase());
        if (startupMode !== "DISABLED" && !this.props.startupParams.st && !highlightCenter) {
            this.props.changeLocateState(startupMode);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.status !== prevProps.status) {
            this.configureLocate(this.props.status);
        }
        if (this.props.messages !== prevProps.messages) {
            this.locate.setStrings(this.props.messages);
        }
        if (this.props.projection !== prevProps.projection) {
            this.locate.setProjection(this.props.projection);
        }
    }
    configureLocate = (newStatus) => {
        const state = this.locate.get("state");
        if (newStatus === "ENABLED" && state === "DISABLED") {
            this.locate.start();
        } else if (newStatus === "FOLLOWING" && state === "ENABLED") {
            this.locate.startFollow();
        } else if (newStatus === "FOLLOWING" && state === "DISABLED") {
            this.locate.start();
            this.locate.startFollow();
        } else if (newStatus === "DISABLED") {
            this.locate.stop();
        }
    }
    onStateChange = (state) => {
        if (this.props.status !== state) {
            this.props.changeLocateState(state);
        }
    }
    onLocationError = (err) => {
        this.props.onLocateError(err.message);
        this.props.changeLocateState("DISABLED");
    }
    render() {
        return null;
    }
}

export default connect((state) => ({
    status: state.locate.state,
    messages: state.locale.messages.locate,
    startupParams: state.localConfig.startupParams
}), {
    changeLocateState,
    onLocateError
})(LocateSupport);

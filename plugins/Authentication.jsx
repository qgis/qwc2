/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import url from 'url';

import ConfigUtils from '../utils/ConfigUtils';


/**
 * Handles authentication
 *
 * Invokes the the authentication service specified by `authServiceUrl` in `config.json`.
 */
class Authentication extends React.Component {
    static propTypes = {
        /** Whether to clear the layer parameter from the URL on login. */
        clearLayerParam: PropTypes.bool,
        /** An idle timeout in seconds after which the user is automatically logged of. */
        idleTimeout: PropTypes.number,
        /** An URL to redirect to on logout, instead of the viewer URL. */
        logoutTargetUrl: PropTypes.string,
        /** Whether authentication is required, i.e. the viewer automatically redirects to the login page if no user is authenticated. */
        requireLogin: PropTypes.bool,
        task: PropTypes.string
    };
    constructor(props) {
        super(props);
        this.idleTimer = null;
    }
    componentDidMount() {
        const username = ConfigUtils.getConfigProp("username");
        if (this.props.requireLogin && !username) {
            this.showLogin();
        }
        if (this.props.idleTimeout && username) {
            this.idleTimer = setTimeout(this.idleAutologout, this.props.idleTimeout * 1000);
            window.addEventListener('keydown', this.resetIdleTimer, {passive: true});
            window.addEventListener('mousedown', this.resetIdleTimer, {passive: true});
            window.addEventListener('wheel', this.resetIdleTimer, {passive: true});
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.task !== prevProps.task) {
            if (this.props.task === "Login") {
                this.showLogin();
            } else if (this.props.task === "Logout") {
                // logout and redirect to custom logoutTargetUrl or current location if not set
                window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "logout?url=" + encodeURIComponent(this.props.logoutTargetUrl || window.location.href);
            }
        }
    }
    showLogin = () => {
        const urlObj = url.parse(window.location.href, true);
        if (this.props.clearLayerParam) {
            delete urlObj.query.l;
        }
        urlObj.search = undefined;
        window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "login?url=" + encodeURIComponent(url.format(urlObj));
    };
    resetIdleTimer = () => {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = setTimeout(this.idleAutologout, this.props.idleTimeout * 1000);
        }
    };
    idleAutologout = () => {
        const urlObj = url.parse(window.location.href, true);
        urlObj.search = undefined;
        const loginUrl = ConfigUtils.getConfigProp("authServiceUrl") + "login?url=" + encodeURIComponent(url.format(urlObj));
        window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "logout?url=" + encodeURIComponent(loginUrl);
    };
    render() {
        return null;
    }
}

export default connect(state => ({
    task: state.task.id
}), {
})(Authentication);

/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import url from 'url';

import Icon from '../components/Icon';
import {AppInfosPortalContext} from '../components/PluginsContainer';
import ConfigUtils from '../utils/ConfigUtils';

import './style/Authentication.css';

/**
 * Handles authentication
 *
 * Invokes the the authentication service specified by `authServiceUrl` in `config.json`.
 */
class Authentication extends React.Component {
    static contextType = AppInfosPortalContext;
    static availableIn3D = true;

    static propTypes = {
        /** Whether to clear the layer parameter from the URL on login. */
        clearLayerParam: PropTypes.bool,
        /** An idle timeout in seconds after which the user is automatically logged of. */
        idleTimeout: PropTypes.number,
        /** An URL to redirect to on logout, instead of the viewer URL. */
        logoutTargetUrl: PropTypes.string,
        /** Whether authentication is required, i.e. the viewer automatically redirects to the login page if no user is authenticated. */
        requireLogin: PropTypes.bool,
        /** Whether to display the currently logged in user below the application menu button. */
        showLoginUser: PropTypes.bool,
        task: PropTypes.object
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
        const task = this.props.task;
        if (task !== prevProps.task) {
            // "Login" and "Logout" task ids are legacy
            if (task.id === "Login" || (task.id === "Authentication" && task.mode === "Login")) {
                this.showLogin();
            } else if (task.id === "Logout" || (task.id === "Authentication" && task.mode === "Logout")) {
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
        if (!this.props.showLoginUser) {
            return null;
        }
        const username = ConfigUtils.getConfigProp("username");
        if (!username) {
            return null;
        }
        return ReactDOM.createPortal((
            <div className="app-info login-user">
                <Icon icon="login" />
                <span>{username}</span>
            </div>
        ), this.context);
    }
}

export default connect(state => ({
    task: state.task
}), {
})(Authentication);

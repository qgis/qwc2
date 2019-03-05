/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const ConfigUtils = require('../utils/ConfigUtils');

class Authentication extends React.Component {
    static propTypes = {
        task: PropTypes.string,
    }
    componentWillReceiveProps(newProps) {
        if(newProps.task !== this.props.task) {
            if(newProps.task === "Login") {
                window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "login?url=" + encodeURIComponent(window.location.href);
            } else if(newProps.task === "Logout") {
                window.location.href = ConfigUtils.getConfigProp("authServiceUrl") + "logout?url=" + encodeURIComponent(window.location.href);
            }
        }
    }
    render() {
        return null;
    }
};

module.exports = {
    AuthenticationPlugin: connect(state => ({
        task: state.task ? state.task.id : null
    }), {
    })(Authentication),
    reducers: {
    }
};

/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Icon from '../components/Icon';
import ConfigUtils from '../utils/ConfigUtils';
import './style/LoginUser.css';


/**
 * Displays the currently logged in user.
 */
class LoginUser extends React.Component {
    static propTypes = {
        rightMargin: PropTypes.string
    };
    render() {
        const username = ConfigUtils.getConfigProp("username");
        const style = {
            right: 'calc(0.25em + ' + this.props.rightMargin + 'px)'
        };
        if (!username) {
            return null;
        }
        return (
            <div className="login-user" style={style}>
                <Icon icon="login" />
                <span>{username}</span>
            </div>
        );
    }
}

export default connect((state) => ({
    rightMargin: state.map.rightMargin
}))(LoginUser);


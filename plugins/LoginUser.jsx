/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const Icon = require('../components/Icon');
const ConfigUtils = require('../utils/ConfigUtils');
require('./style/LoginUser.css');


class LoginUser extends React.Component {
    static propTypes = {
    }
    state = {
    }
    render() {
        let username = ConfigUtils.getConfigProp("username");
        if(!username) {
            return null;
        }
        return (
            <div className="login-user">
                <Icon icon="login" />
                <span>{username}</span>
            </div>
        );
    }
};

module.exports = {
    LoginUserPlugin: LoginUser
}

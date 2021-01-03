/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import Icon from '../components/Icon';
import ConfigUtils from '../utils/ConfigUtils';
import './style/LoginUser.css';


export default class LoginUser extends React.Component {
    static propTypes = {
    }
    state = {
    }
    render() {
        const username = ConfigUtils.getConfigProp("username");
        if (!username) {
            return null;
        }
        return (
            <div className="login-user">
                <Icon icon="login" />
                <span>{username}</span>
            </div>
        );
    }
}

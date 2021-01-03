/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';

export default class Message extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        msgId: PropTypes.string.isRequired
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        return (<span className={this.props.className || ""}>{this.context.messages[this.props.msgId] || this.props.msgId}</span>);
    }
}

/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');

class Message extends React.Component {
    static propTypes = {
        msgId: PropTypes.string.isRequired
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        return (<span>{this.context.messages[this.props.msgId] || this.props.msgId}</span>);
    }
}

module.exports = Message;

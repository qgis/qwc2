/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
require('./style/MessageBar.css');

const MessageBar = React.createClass({
    propTypes: {
        name: React.PropTypes.string.isRequired,
        onClose: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            onClose: () => {}
        }
    },
    renderRole(role) {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    },
    render() {
        return (
            <div id="MessageBar">
                <div className="messagebar">
                    <span className="messagebody">
                        {this.renderRole("body")}
                    </span>
                    <span className="closewrapper">
                        <Glyphicon className="close" onClick={this.props.onClose} glyph="remove"/>
                    </span>
                </div>
            </div>
        );
    }
});

module.exports = MessageBar;

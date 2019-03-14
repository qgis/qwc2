/**
 * Copyright 2019, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Icon = require('./Icon');
require('./style/MessageBar.css');

class MessageBar extends React.Component {
    static propTypes = {
        onHide: PropTypes.func,
        className: PropTypes.string,
        hideOnTaskChange: PropTypes.bool,
        task: PropTypes.string
    }
    static defaultProps = {
        onHide: () => {},
        hideOnTaskChange: false
    }
    componentWillReceiveProps(newProps) {
        if(newProps.task !== this.props.task && newProps.hideOnTaskChange) {
            this.props.onHide();
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    }
    render() {
        let contents = (typeof this.props.children === "function") ? this.props.children() : null;
        return (
            <div>
                <div id="MessageBar">
                    <div className={"messagebar " + (this.props.className || "")}>
                        <div className="body">
                            {contents ? contents.body || null : this.renderRole("body")}
                        </div>
                        <span className="closewrapper">
                            <Icon className="close" onClick={this.props.onHide} icon="remove" size="large"/>
                        </span>
                    </div>
                </div>
                {contents ? contents.extra || null : this.renderRole("extra")}
            </div>
        );
    }
};

const selector = (state) => ({
    task: state.task ? state.task.id : null
});

module.exports = {
    MessageBar: connect(selector, {})(MessageBar)
}

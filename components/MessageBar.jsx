/**
 * Copyright 2019-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import Icon from './Icon';

import './style/MessageBar.css';

class MessageBar extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string,
        hideOnTaskChange: PropTypes.bool,
        onHide: PropTypes.func,
        task: PropTypes.string
    };
    static defaultProps = {
        onHide: () => {}
    };
    componentDidUpdate(prevProps) {
        if (this.props.task !== prevProps.task && this.props.hideOnTaskChange) {
            this.props.onHide();
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    };
    render() {
        const contents = (typeof this.props.children === "function") ? this.props.children() : null;
        return (
            <div>
                <div className={"messagebar " + (this.props.className || "")}>
                    <div className="body">
                        {contents ? contents.body || null : this.renderRole("body")}
                    </div>
                    <span className="closewrapper">
                        <Icon className="close" icon="remove" onClick={this.props.onHide} size="large"/>
                    </span>
                </div>
                {contents ? contents.extra || null : this.renderRole("extra")}
            </div>
        );
    }
}

const selector = (state) => ({
    task: state.task.id
});

export default connect(selector, {})(MessageBar);

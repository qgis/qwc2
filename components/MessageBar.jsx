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
        mapMargins: PropTypes.object,
        menuMargins: PropTypes.object,
        onHide: PropTypes.func,
        task: PropTypes.string
    };
    componentDidUpdate(prevProps) {
        if (this.props.task !== prevProps.task && this.props.hideOnTaskChange) {
            this.props.onHide();
        }
    }
    renderRole = (role) => {
        const children = typeof this.props.children === "function" ?
            this.props.children() :
            React.Children.toArray(this.props.children).reduce((res, child) => ({...res, [child.props.role]: child}), {});
        return children[role];
    };
    render() {
        const containerStyle = {
            left: (this.props.menuMargins.left + this.props.mapMargins.left) +  'px',
            right: (this.props.menuMargins.right + this.props.mapMargins.right) + 'px'
        };
        return (
            <div>
                <div className="messagebar-container" style={containerStyle}>
                    <div className={"messagebar " + (this.props.className || "")}>
                        <div className="body">
                            {this.renderRole("body")}
                        </div>
                        {this.props.onHide ? (
                            <span className="closewrapper">
                                <Icon className="close" icon="remove" onClick={this.props.onHide} size="large"/>
                            </span>
                        ) : null}
                    </div>
                </div>
                {this.renderRole("extra")}
            </div>
        );
    }
}

const selector = (state) => ({
    task: state.task.id,
    mapMargins: state.windows.mapMargins,
    menuMargins: state.windows.menuMargins
});

export default connect(selector, {})(MessageBar);

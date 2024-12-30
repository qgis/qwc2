/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import Icon from './Icon';

import './style/TaskBar.css';


class TaskBar extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.object,
        mapMargins: PropTypes.object,
        menuMargins: PropTypes.object,
        onHide: PropTypes.func,
        onShow: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        task: PropTypes.string.isRequired,
        unblockOnClose: PropTypes.bool
    };
    static defaultProps = {
        onShow: () => {},
        onHide: () => {}
    };
    componentDidUpdate(prevProps) {
        const newVisible = this.props.currentTask?.id === this.props.task;
        const oldVisible = prevProps.currentTask?.id === this.props.task;
        if (newVisible && (!oldVisible || this.props.currentTask.mode !== prevProps.currentTask?.mode)) {
            this.props.onShow(this.props.currentTask.mode, this.props.currentTask.data);
        } else if (!newVisible && oldVisible) {
            this.props.onHide();
        }
    }
    closeClicked = () => {
        if (this.props.unblockOnClose) {
            this.props.setCurrentTaskBlocked(false);
        }
        this.props.setCurrentTask(null);
    };
    renderRole = (role) => {
        const children = typeof this.props.children === "function" ?
            this.props.children() :
            React.Children.toArray(this.props.children).reduce((res, child) => ({...res, [child.props.role]: child}), {});
        return children[role];
    };
    render() {
        if (this.props.currentTask.id !== this.props.task) {
            return null;
        }
        const containerStyle = {
            left: (this.props.menuMargins.left + this.props.mapMargins.left) +  'px',
            right: (this.props.menuMargins.right + this.props.mapMargins.right) + 'px'
        };
        return (
            <div>
                <div className="taskbar-container" style={containerStyle}>
                    <div className={"taskbar " + this.props.task}>
                        <div className="body">
                            {this.renderRole("body")}
                        </div>
                        {this.props.onHide ? (
                            <span className="closewrapper">
                                <Icon className="close" icon="remove" onClick={this.closeClicked} size="large"/>
                            </span>
                        ) : null}
                    </div>
                </div>
                {this.renderRole("extra")}
            </div>
        );
    }
}


export default connect((state) => ({
    currentTask: state.task,
    mapMargins: state.windows.mapMargins,
    menuMargins: state.windows.menuMargins
}), {
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TaskBar);

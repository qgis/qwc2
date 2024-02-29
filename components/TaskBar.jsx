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
import MessageBar from './MessageBar';

class TaskBar extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.object,
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
        const newVisible = this.props.currentTask && this.props.currentTask.id === this.props.task;
        const oldVisible = prevProps.currentTask && prevProps.currentTask.id === this.props.task;
        if (newVisible && (!oldVisible || this.props.currentTask.mode !== prevProps.currentTask.mode)) {
            this.props.onShow(this.props.currentTask.mode, this.props.currentTask.data);
        } else if (!newVisible && oldVisible) {
            this.props.onHide();
        }
    }
    closeClicked = () => {
        if (this.props.currentTask.id === this.props.task) {
            if (this.props.unblockOnClose) {
                this.props.setCurrentTaskBlocked(false);
            }
            this.props.setCurrentTask(null);
        }
    };
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    };
    render() {
        if (this.props.currentTask.id !== this.props.task) {
            return null;
        }
        return (
            <MessageBar className={this.props.task} onHide={this.closeClicked}>
                {this.props.children}
            </MessageBar>
        );
    }
}

const selector = (state) => ({
    currentTask: state.task
});

export default connect(selector, {
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TaskBar);

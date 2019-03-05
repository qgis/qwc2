/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {setCurrentTask,setCurrentTaskBlocked} = require("../actions/task");
const Icon = require('./Icon');
const {MessageBar} = require('./MessageBar');

class TaskBar extends React.Component {
    static propTypes = {
        task: PropTypes.string.isRequired,
        currentTask: PropTypes.object,
        onShow: PropTypes.func,
        onHide: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        unblockOnClose: PropTypes.bool
    }
    static defaultProps = {
        onShow: (mode) => {},
        onHide: () => {},
        unblockOnClose: false
    }
    componentWillReceiveProps(newProps) {
        let newVisible = newProps.currentTask && newProps.currentTask.id === newProps.task;
        let oldVisible = this.props.currentTask && this.props.currentTask.id === newProps.task;
        if(newVisible && (!oldVisible || newProps.currentTask.mode !== this.props.currentTask.mode)) {
            newProps.onShow(newProps.currentTask.mode);
        } else if(!newVisible && oldVisible) {
            newProps.onHide();
        }
    }
    closeClicked = () => {
        if(this.props.currentTask.id === this.props.task) {
            if(this.props.unblockOnClose) {
                this.props.setCurrentTaskBlocked(false);
            }
            this.props.setCurrentTask(null);
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    }
    render() {
        if(this.props.currentTask.id !== this.props.task) {
            return null;
        }
        return (
            <MessageBar onHide={this.closeClicked} className={this.props.task}>
                {this.props.children}
            </MessageBar>
        );
    }
};

const selector = (state) => ({
    currentTask: state.task
});

module.exports = {
    TaskBar: connect(selector, {
        setCurrentTask: setCurrentTask,
        setCurrentTaskBlocked: setCurrentTaskBlocked
    })(TaskBar),
    reducers: {
        task: require('../reducers/task')
    }
}

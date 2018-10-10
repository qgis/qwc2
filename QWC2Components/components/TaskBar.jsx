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
const {setCurrentTask} = require("../actions/task");
const Icon = require('./Icon');
require('./style/TaskBar.css');

class TaskBar extends React.Component {
    static propTypes = {
        task: PropTypes.string.isRequired,
        currentTask: PropTypes.object,
        onShow: PropTypes.func,
        onHide: PropTypes.func
    }
    static defaultProps = {
        onShow: (mode) => {},
        onHide: () => {}
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
        let contents = (typeof this.props.children === "function") ? this.props.children() : null;
        return (
            <div>
                <div id="TaskBar" className={this.props.task}>
                    <div className="taskbar">
                        <div className="body">
                            {contents ? contents.body || null : this.renderRole("body")}
                        </div>
                        <span className="closewrapper">
                            <Icon className="close" onClick={this.closeClicked} icon="remove" size="large"/>
                        </span>
                    </div>
                </div>
                {contents ? contents.extra || null : this.renderRole("extra")}
            </div>
        );
    }
};

const selector = (state) => ({
    currentTask: state.task
});

module.exports = {
    TaskBar: connect(selector, {
        setCurrentTask: setCurrentTask,
    })(TaskBar),
    reducers: {
        task: require('../reducers/task')
    }
}

/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import {MapContainerPortalContext} from '../components/PluginsContainer';
import Icon from './Icon';

import './style/TaskBar.css';


class TaskBar extends React.Component {
    static contextType = MapContainerPortalContext;
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
        return ReactDOM.createPortal((
            <div>
                <div className="taskbar-container">
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
        ), this.context);
    }
}


export default connect((state) => ({
    currentTask: state.task
}), {
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked
})(TaskBar);

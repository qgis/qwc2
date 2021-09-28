/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {Swipeable} from 'react-swipeable';
import Icon from './Icon';
import {setCurrentTask} from '../actions/task';
import LocaleUtils from '../utils/LocaleUtils';
import './style/SideBar.css';

class SideBar extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.object,
        extraBeforeContent: PropTypes.object,
        extraClasses: PropTypes.string,
        extraTitlebarContent: PropTypes.object,
        icon: PropTypes.string,
        id: PropTypes.string.isRequired,
        minWidth: PropTypes.string,
        onHide: PropTypes.func,
        onShow: PropTypes.func,
        setCurrentTask: PropTypes.func,
        title: PropTypes.string,
        width: PropTypes.string,
        side: PropTypes.string
    }
    static defaultProps = {
        extraClasses: '',
        onShow: () => {},
        onHide: () => {},
        width: '15em',
        minWidth: '15em',
        // allowed values are 'left' and 'right'
        side: 'right'
    }
    state = {
        render: false
    }
    constructor(props) {
        super(props);
        this.state.render = props.currentTask && props.currentTask.id === props.id;
    }
    componentDidUpdate(prevProps, prevState) {
        const newVisible = this.props.currentTask && this.props.currentTask.id === this.props.id;
        const oldVisible = prevProps.currentTask && prevProps.currentTask.id === prevProps.id;
        if (newVisible && (!oldVisible || this.props.currentTask.mode !== prevProps.currentTask.mode)) {
            this.setState({render: true});
            this.props.onShow(this.props.currentTask.mode);
        } else if (!newVisible && oldVisible) {
            this.props.onHide();
            // Hide the element after the transition period (see SideBar.css)
            setTimeout(() => { this.setState({render: false}); }, 300);
        }
    }
    closeClicked = () => {
        if (this.props.currentTask.id === this.props.id) {
            this.props.setCurrentTask(null);
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    }
    render() {
        const visible = this.props.currentTask.id === this.props.id;
        const render = visible || this.state.render;
        const style = {
            width: this.props.width,
            minWidth: this.props.minWidth,
            transform: '',
            left: '',
            right: '',
            zIndex: visible ? 5 : 4
        };
        let closeIcon;
        if (this.props.side === "right") {
            style.transform = visible ? '' : 'translateX(100%) translateX(8px)';
            style.left = '';
            style.right = 0;
            closeIcon = "chevron-right";
        } else if(this.props.side === "left") {
            style.transform = visible ? '' : 'translateX(-100%) translateX(-8px)';
            style.right = '';
            style.left = 0;
            closeIcon = "chevron-left"
        }
        let contents = null;
        if (render && typeof this.props.children === "function") {
            contents = this.props.children();
        }
        let body = null;
        let extra = null;
        if (render) {
            body = contents ? contents.body || null : this.renderRole("body");
            extra = contents ? contents.extra || null : this.renderRole("extra");
        }
        return (
            <div>
                <Swipeable delta={30} onSwipedRight={this.closeClicked}>
                    <div className={"sidebar" + " " + this.props.extraClasses} id={this.props.id} style={style}>
                        <div className="sidebar-titlebar">
                            {this.state.render ? this.props.extraBeforeContent : null}
                            <Icon className="sidebar-titlebar-icon" icon={this.props.icon} size="large"/>
                            <span className="sidebar-titlebar-title">{LocaleUtils.tr(this.props.title)}</span>
                            {this.state.render ? this.props.extraTitlebarContent : null}
                            <span className="sidebar-titlebar-spacer" />
                            <Icon className="sidebar-titlebar-closeicon" icon={closeIcon} onClick={this.closeClicked}/>
                        </div>
                        <div className="sidebar-body">
                            {body}
                        </div>
                    </div>
                </Swipeable>
                {extra}
            </div>
        );
    }
}

const selector = (state) => ({
    currentTask: state.task
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(SideBar);

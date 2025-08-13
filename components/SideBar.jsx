/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import Icon from './Icon';
import {Swipeable} from './Swipeable';

import './style/SideBar.css';

class SideBar extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.object,
        extraBeforeContent: PropTypes.object,
        extraClasses: PropTypes.string,
        extraTitlebarContent: PropTypes.object,
        heightResizeable: PropTypes.bool,
        icon: PropTypes.string,
        id: PropTypes.string.isRequired,
        mapMargins: PropTypes.object,
        minWidth: PropTypes.string,
        onHide: PropTypes.func,
        onShow: PropTypes.func,
        setCurrentTask: PropTypes.func,
        side: PropTypes.string,
        title: PropTypes.string,
        width: PropTypes.string
    };
    static defaultProps = {
        extraClasses: '',
        onShow: () => {},
        onHide: () => {},
        width: '15em',
        minWidth: '15em',
        // allowed values are 'left' and 'right'
        side: 'right'
    };
    state = {
        render: false
    };
    constructor(props) {
        super(props);
        this.state.render = props.currentTask && props.currentTask.id === props.id;
        this.sidebar = null;
    }
    componentDidUpdate(prevProps) {
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
        if (!this.props.heightResizeable && prevProps.heightResizeable) {
            this.sidebar.style.height = '';
        }
    }
    closeClicked = () => {
        if (this.props.currentTask.id === this.props.id) {
            this.props.setCurrentTask(null);
        }
    };
    renderRole = (role) => {
        const children = typeof this.props.children === "function" ?
            this.props.children() :
            React.Children.toArray(this.props.children).reduce((res, child) => ({...res, [child.props.role]: child}), {});
        return children[role];
    };
    render() {
        const visible = this.props.currentTask.id === this.props.id;
        const render = visible || this.state.render;
        const marginLeft = this.props.mapMargins.left + this.props.mapMargins.outerLeft;
        const marginRight = this.props.mapMargins.right + this.props.mapMargins.outerRight;
        const style = {
            width: this.props.width,
            minWidth: this.props.minWidth,
            zIndex: visible ? 5 : 4,
            maxWidth: 'calc(100vw - ' + marginLeft + 'px - ' + marginRight + 'px)'
        };
        const isLeftSide = this.props.side === "left";
        if (isLeftSide) {
            style.left = visible ? (this.props.mapMargins.left + this.props.mapMargins.outerLeft) : 0;
        } else {
            style.right = visible ? (this.props.mapMargins.right + this.props.mapMargins.outerRight) : 0;
        }

        const classes = classnames({
            "sidebar": true,
            "sidebar-open": visible,
            "sidebar-left": isLeftSide,
            "sidebar-right": !isLeftSide
        });
        const closeIcon = isLeftSide ? "chevron-left" : "chevron-right";

        let body = null;
        let extra = null;
        if (render) {
            body = this.renderRole("body");
            extra = this.renderRole("extra");
        }
        return (
            <div>
                <Swipeable delta={30} onSwipedRight={this.closeClicked}>
                    <div className={`${classes} ${this.props.extraClasses}`} id={this.props.id} ref={this.setRef} style={style}>
                        <div className={"sidebar-resize-handle sidebar-resize-handle-" + this.props.side} onPointerDown={this.startSidebarResize}/>
                        <div className="sidebar-titlebar">
                            {this.state.render ? this.props.extraBeforeContent : null}
                            <Icon className="sidebar-titlebar-icon" icon={this.props.icon} size="large"/>
                            <span className="sidebar-titlebar-title">{this.props.title}</span>
                            {this.state.render ? this.props.extraTitlebarContent : null}
                            <span className="sidebar-titlebar-spacer" />
                            <Icon className="sidebar-titlebar-closeicon" icon={closeIcon} onClick={this.closeClicked}/>
                        </div>
                        <div className="sidebar-body">
                            {body}
                        </div>
                        {this.props.heightResizeable ? (
                            <div className="sidebar-resize-handle-bottom" onPointerDown={this.startSidebarBottomResize}/>
                        ) : null}
                    </div>
                </Swipeable>
                {extra}
            </div>
        );
    }
    setRef = (el) => {
        this.sidebar = el;
    };
    startSidebarResize = (ev) => {
        const startWidth = this.sidebar.offsetWidth;
        const startMouseX = ev.clientX;
        const sign = this.props.side === 'left' ? -1 : 1;
        const resizeSidebar = (event) => {
            this.sidebar.style.width = (startWidth + sign * (startMouseX - event.clientX)) + 'px';
        };
        ev.view.document.body.style.userSelect = 'none';
        ev.view.addEventListener("pointermove", resizeSidebar);
        ev.view.addEventListener("pointerup", () => {
            ev.view.document.body.style.userSelect = '';
            ev.view.removeEventListener("pointermove", resizeSidebar);
        }, {once: true});
    };
    startSidebarBottomResize = (ev) => {
        const startHeight = this.sidebar.offsetHeight;
        const startMouseY = ev.clientY;
        const resizeSidebar = (event) => {
            this.sidebar.style.height = Math.max(64, (startHeight + (event.clientY - startMouseY))) + 'px';
        };
        ev.view.document.body.style.userSelect = 'none';
        ev.view.addEventListener("pointermove", resizeSidebar);
        ev.view.addEventListener("pointerup", () => {
            ev.view.document.body.style.userSelect = '';
            ev.view.removeEventListener("pointermove", resizeSidebar);
        }, {once: true});
    };
}


export default connect((state) => ({
    currentTask: state.task,
    mapMargins: state.windows.mapMargins
}), {
    setCurrentTask: setCurrentTask
})(SideBar);

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

import classnames from 'classnames';
import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {setCurrentTask} from '../actions/task';
import {setSplitScreen} from '../actions/windows';
import Icon from './Icon';
import {MapContainerPortalContext} from './PluginsContainer';
import {Swipeable} from './Swipeable';

import './style/SideBar.css';

class SideBar extends React.Component {
    static contextType = MapContainerPortalContext;
    static propTypes = {
        bottombarHeight: PropTypes.number,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        currentTask: PropTypes.object,
        extraBeforeContent: PropTypes.object,
        extraClasses: PropTypes.string,
        extraTitlebarContent: PropTypes.object,
        heightResizeable: PropTypes.bool,
        icon: PropTypes.string,
        id: PropTypes.string.isRequired,
        maxWidth: PropTypes.string,
        minWidth: PropTypes.string,
        onHide: PropTypes.func,
        onShow: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setSplitScreen: PropTypes.func,
        side: PropTypes.string,
        splitScreen: PropTypes.bool,
        title: PropTypes.string,
        topbarHeight: PropTypes.number,
        visible: PropTypes.bool,
        width: PropTypes.string,
        widthResizeable: PropTypes.bool
    };
    static defaultProps = {
        widthResizeable: true,
        extraClasses: '',
        onShow: () => {},
        onHide: () => {},
        width: '15em',
        minWidth: '15em',
        // allowed values are 'left' and 'right'
        side: 'right'
    };
    state = {
        visible: false,
        render: false,
        width: '15em',
        widthProp: '15em',
        height: ''
    };
    constructor(props) {
        super(props);
        this.state.visible = props.visible || props.currentTask?.id === props.id;
        this.state.render = this.state.visible;
        this.state.width = this.state.widthProp = props.width;
        this.sidebar = null;
        this.id = uuidv4();
    }
    componentDidUpdate(prevProps, prevState) {

        if (this.state.visible && (!prevState.visible || this.props.currentTask?.mode !== prevProps.currentTask?.mode)) {
            this.setState({render: true}, () => this.sidebar.querySelector('[tabindex="0"]')?.focus?.());
            this.props.onShow(this.props.currentTask.mode);
            if (this.sidebar && this.state.visible && this.props.splitScreen) {
                this.props.setSplitScreen(this.id, this.props.side, this.sidebar.clientWidth, false);
            }
        } else if (!this.state.visible && prevState.visible) {
            this.props.onHide();
            // Hide the element after the transition period (see SideBar.css)
            setTimeout(() => this.setState({render: false}), 300);
            if (this.props.splitScreen) {
                this.props.setSplitScreen(this.id, null, null, false);
            }
        }
        if (!this.props.heightResizeable && prevProps.heightResizeable) {
            this.setState({height: ''});
        }
        if (this.props.splitScreen && this.state.visible && this.sidebar && this.state.width !== prevState.width) {
            // Since the sidebar width transition is animated, we cannot measure its width, as it still might be changing
            // Hence measure the pixel width on a dummy element
            const div = document.createElement("div");
            this.sidebar.parentElement.appendChild(div);
            div.style.width = this.state.width;
            div.style.minWidth = this.sidebar.style.minWidth;
            div.style.maxWidth = this.sidebar.style.maxWidth;
            this.props.setSplitScreen(this.id, this.props.side, div.offsetWidth, false);
            this.sidebar.parentElement.removeChild(div);
        }
    }
    static getDerivedStateFromProps(nextProps, state) {
        const newState = {};
        if (nextProps.width !== state.widthProp) {
            newState.widthProp = newState.width = nextProps.width;
        }
        const visible = nextProps.visible || nextProps.currentTask?.id === nextProps.id;
        if (visible !== state.visible) {
            newState.visible = visible;
        }
        return newState;
    }
    closeClicked = () => {
        if (this.props.visible) {
            this.props.onHide();
        } else if (this.props.currentTask?.id === this.props.id) {
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
        const style = {
            top: this.props.splitScreen ? this.props.topbarHeight + 'px' : undefined,
            bottom: this.props.splitScreen ? this.props.bottombarHeight + 'px' : undefined,
            width: this.state.width,
            height: this.props.splitScreen ? undefined : this.state.height,
            minWidth: this.props.minWidth,
            maxWidth: this.props.maxWidth,
            zIndex: this.state.visible ? 5 : 4
        };
        const isLeftSide = this.props.side === "left";

        const classes = classnames({
            "sidebar": true,
            "sidebar-open": this.state.visible,
            "sidebar-left": isLeftSide,
            "sidebar-right": !isLeftSide
        });
        const closeIcon = isLeftSide ? "chevron-left" : "chevron-right";

        let body = null;
        let extra = null;
        if (this.state.visible) {
            body = this.renderRole("body");
            extra = this.renderRole("extra");
        }
        const result = (
            <div>
                <Swipeable delta={30} onSwipedRight={this.closeClicked}>
                    <div className={`${classes} ${this.props.extraClasses}`} id={this.props.id} inert={!this.state.visible} ref={this.setRef} style={style}>
                        {this.props.widthResizeable ? (
                            <div className={"sidebar-resize-handle sidebar-resize-handle-" + this.props.side} onPointerDown={this.startSidebarResize}/>
                        ) : null}
                        <div className="sidebar-titlebar">
                            {this.state.visible ? this.props.extraBeforeContent : null}
                            {this.props.icon ? (<Icon className="sidebar-titlebar-icon" icon={this.props.icon} size="large"/>) : null}
                            <span className="sidebar-titlebar-title">{this.props.title}</span>
                            {this.state.visible ? this.props.extraTitlebarContent : null}
                            <span className="sidebar-titlebar-spacer" />
                            <Icon className="sidebar-titlebar-closeicon" icon={closeIcon} onClick={this.closeClicked}/>
                        </div>
                        <div className="sidebar-body">
                            {body}
                        </div>
                        {this.props.heightResizeable && !this.props.splitScreen ? (
                            <div className="sidebar-resize-handle-bottom" onPointerDown={this.startSidebarBottomResize}/>
                        ) : null}
                    </div>
                </Swipeable>
                {extra}
            </div>
        );
        return this.props.splitScreen ? result : ReactDOM.createPortal(result, this.context);
    }
    setRef = (el) => {
        this.sidebar = el;
    };
    startSidebarResize = (ev) => {
        const startWidth = this.sidebar.offsetWidth;
        const startMouseX = ev.clientX;
        const sign = this.props.side === 'left' ? -1 : 1;
        this.sidebar.style.transition = 'none';
        const resizeSidebar = (event) => {
            this.setState({width: (startWidth + sign * (startMouseX - event.clientX)) + "px"});
        };
        ev.view.document.body.style.userSelect = 'none';
        ev.view.addEventListener("pointermove", resizeSidebar);
        ev.view.addEventListener("pointerup", () => {
            this.sidebar.style.transition = '';
            ev.view.document.body.style.userSelect = '';
            ev.view.removeEventListener("pointermove", resizeSidebar);
        }, {once: true});
    };
    startSidebarBottomResize = (ev) => {
        const startHeight = this.sidebar.offsetHeight;
        const startMouseY = ev.clientY;
        const resizeSidebar = (event) => {
            this.setState({height: Math.max(64, (startHeight + (event.clientY - startMouseY))) + "px"});
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
    topbarHeight: state.windows.topbarHeight,
    bottombarHeight: state.windows.bottombarHeight
}), {
    setCurrentTask: setCurrentTask,
    setSplitScreen: setSplitScreen
})(SideBar);

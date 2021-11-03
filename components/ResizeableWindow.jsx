/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {connect} from 'react-redux';
import {Rnd} from 'react-rnd';
import uuid from 'uuid';
import {raiseWindow, registerWindow, unregisterWindow} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import Icon from './Icon';
import './style/ResizeableWindow.css';

const WINDOW_GEOMETRIES = {};

class ResizeableWindow extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        dockable: PropTypes.bool,
        extraControls: PropTypes.arrayOf(PropTypes.shape({
            icon: PropTypes.string.isRequired,
            callback: PropTypes.func.isRequired
        })),
        icon: PropTypes.string,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initialX: PropTypes.number,
        initialY: PropTypes.number,
        initiallyDocked: PropTypes.bool,
        maxHeight: PropTypes.number,
        maxWidth: PropTypes.number,
        minHeight: PropTypes.number,
        minWidth: PropTypes.number,
        onClose: PropTypes.func,
        onGeometryChanged: PropTypes.func,
        raiseWindow: PropTypes.func,
        registerWindow: PropTypes.func,
        scrollable: PropTypes.bool,
        title: PropTypes.string,
        titlelabel: PropTypes.string,
        unregisterWindow: PropTypes.func,
        visible: PropTypes.bool,
        windowStacking: PropTypes.array
    }
    static defaultProps = {
        initialX: null,
        initialY: null,
        initialWidth: 240,
        initialHeight: 320,
        minWidth: 50,
        minHeight: 50,
        maxWidth: null,
        maxHeight: null,
        onClose: () => {},
        visible: true,
        dockable: true,
        onGeometryChanged: () => {}
    }
    state = {
        geometry: null
    }
    constructor(props) {
        super(props);
        this.rnd = null;
        const height = Math.min(props.initialHeight, window.innerHeight - 100);
        if (WINDOW_GEOMETRIES[props.title]) {
            this.state.geometry = WINDOW_GEOMETRIES[props.title];
        } else {
            this.state.geometry = {
                x: props.initialX !== null ? props.initialX : Math.max(0, Math.round(0.5 * (window.innerWidth - props.initialWidth))),
                y: props.initialY !== null ? props.initialY : Math.max(0, Math.round(0.5 * height)),
                width: props.initialWidth,
                height: height,
                docked: props.initiallyDocked || false
            };
        }
        this.dragShield = null;
        this.id = uuid.v1();
    }
    componentDidMount() {
        this.props.registerWindow(this.id);
    }
    componentWillUnmount() {
        this.props.unregisterWindow(this.id);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.rnd && this.props.visible && this.props.visible !== prevProps.visible) {
            this.rnd.updatePosition(this.state.geometry);
        }
        if (this.state.geometry !== prevState.geometry) {
            this.props.onGeometryChanged(this.state.geometry);
            if (this.props.title) {
                WINDOW_GEOMETRIES[this.props.title] = this.state.geometry;
            }
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    }
    stopEvent = (ev) => {
        ev.stopPropagation();
    }
    onClose = (ev) => {
        this.props.onClose();
        ev.stopPropagation();
    }
    render() {
        const dockable = this.props.dockable && ConfigUtils.getConfigProp("globallyDisableDockableDialogs") !== true;
        let icon = null;
        if (this.props.icon) {
            icon = (<Icon className="resizeable-window-titlebar-icon" icon={this.props.icon} />);
        }
        const bodyclasses = classnames({
            "resizeable-window-body": true,
            "resizeable-window-body-scrollable": this.props.scrollable,
            "resizeable-window-body-nonscrollable": !this.props.scrollable
        });
        const style = {display: this.props.visible ? 'initial' : 'none'};
        const maximized = this.state.geometry.maximized ? true : false;
        const zIndex = 10 + this.props.windowStacking.findIndex(item => item === this.id);

        const content = [
            (<div className="resizeable-window-titlebar" key="titlebar" onDoubleClick={this.toggleMaximize}>
                {icon}
                <span className="resizeable-window-titlebar-title">
                    {this.props.title ? LocaleUtils.tr(this.props.title) : (this.props.titlelabel || "")}
                </span>
                {(this.props.extraControls || []).map(entry => (
                    <Icon className="resizeable-window-titlebar-control" icon={entry.icon} key={entry.icon} onClick={entry.callback}/>
                ))}
                {!maximized && dockable ? (
                    <Icon
                        className="resizeable-window-titlebar-control" icon={this.state.geometry.docked ? "undock" : "dock"}
                        onClick={this.toggleDock}
                        titlemsgid={this.state.geometry.docked ? LocaleUtils.trmsg("window.undock") : LocaleUtils.trmsg("window.dock")} />
                ) : null}
                <Icon className="resizeable-window-titlebar-control" icon={maximized ? "unmaximize" : "maximize"} onClick={this.toggleMaximize} titlemsgid={maximized ? LocaleUtils.trmsg("window.unmaximize") : LocaleUtils.trmsg("window.maximize")} />
                <Icon className="resizeable-window-titlebar-control" icon="remove" onClick={this.onClose} titlemsgid={LocaleUtils.trmsg("window.close")} />
            </div>),
            (<div className={bodyclasses} key="body" onMouseDown={(ev) => { this.stopEvent(ev); this.props.raiseWindow(this.id); }} onMouseUp={this.stopEvent} onTouchStart={this.stopEvent}>
                <div className="resizeable-window-drag-shield" ref={el => {this.dragShield = el; }} />
                {this.renderRole("body")}
            </div>)
        ];

        if (this.state.geometry.maximized && this.props.visible) {
            return (
                <div className="maximized-window" style={{zIndex: zIndex }}>{content}</div>
            );
        } else if (this.state.geometry.docked && this.props.visible) {
            return (
                <div className="dock-window" onMouseDown={this.startDockResize} ref={c => { this.dock = c; }} style={{zIndex: zIndex, width: this.props.initialWidth + 'px'}}>
                    {content}
                </div>
            );
        } else {
            return (
                <div className="resizeable-window-container" style={style}>
                    <Rnd bounds="parent" className="resizeable-window" default={this.state.geometry}
                        maxHeight={this.props.maxHeight || window.innerHeight} maxWidth={this.props.maxWidth || window.innerWidth}
                        minHeight={this.props.minHeight} minWidth={this.props.minWidth}
                        onDragStart={this.onDragStart}
                        onDragStop={this.onDragStop}
                        onMouseDown={() => this.props.raiseWindow(this.id)}
                        onResizeStop={this.onResizeStop}
                        ref={c => { this.rnd = c; }} style={{zIndex: zIndex}}>
                        {content}
                    </Rnd>
                </div>
            );
        }
    }
    onDragStart = () => {
        if (this.dragShield) {
            this.dragShield.style.display = 'initial';
        }
    }
    onDragStop = (ev, data) => {
        const geometry = {...this.state.geometry, x: data.x, y: data.y};
        this.setState({geometry: geometry});
        if (this.dragShield) {
            this.dragShield.style.display = 'none';
        }
    }
    onResizeStop = (ev, dir, ref, delta, position) => {
        const geometry = {
            ...this.state.geometry,
            x: position.x,
            y: position.y,
            width: this.state.geometry.width + delta.width,
            height: this.state.geometry.height + delta.height
        };
        this.setState({geometry: geometry});
    }
    toggleDock = () => {
        const geometry = {
            ...this.state.geometry,
            docked: !this.state.geometry.docked
        };
        this.setState({geometry: geometry});
    }
    toggleMaximize = () => {
        const geometry = {
            ...this.state.geometry,
            maximized: !this.state.geometry.maximized
        };
        this.setState({geometry: geometry});
    }
    startDockResize = (ev) => {
        if (ev.target === this.dock) {
            this.dockResizeStartWidth = ev.target.offsetWidth;
            this.dockResizeStartMouse = ev.clientX;
            document.addEventListener("mousemove", this.resizeDock);
            document.addEventListener("mouseup", this.endDockResize);
        }
    }
    endDockResize = () => {
        document.removeEventListener("mousemove", this.resizeDock);
        document.removeEventListener("mouseup", this.endDockResize);
        this.dockResizeStartWidth = undefined;
        this.dockResizeStartMouse = undefined;
    }
    resizeDock = (ev) => {
        if (this.dock) {
            this.dock.style.width = (this.dockResizeStartWidth + ev.clientX - this.dockResizeStartMouse) + 'px';
        }
    }
}

export default connect((state) => ({
    windowStacking: state.windows.stacking
}), {
    raiseWindow: raiseWindow,
    registerWindow: registerWindow,
    unregisterWindow: unregisterWindow
})(ResizeableWindow);

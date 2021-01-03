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
import {Rnd} from 'react-rnd';
import Message from '../components/I18N/Message';
import ConfigUtils from '../utils/ConfigUtils';
import Icon from './Icon';
import './style/ResizeableWindow.css';

export default class ResizeableWindow extends React.Component {
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
        scrollable: PropTypes.bool,
        title: PropTypes.string,
        titlelabel: PropTypes.string,
        visible: PropTypes.bool,
        zIndex: PropTypes.number
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
        zIndex: 8,
        visible: true,
        dockable: true
    }
    state = {
        dock: false
    }
    constructor(props) {
        super(props);
        this.rnd = null;
        this.state.doc = props.initiallyDocked || false;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.rnd && this.props.visible && this.props.visible !== prevProps.visible) {
            this.rnd.updatePosition(this.initialPosition());
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
    initialPosition = () => {
        return {
            x: this.props.initialX !== null ? this.props.initialX : Math.max(0, Math.round(0.5 * (window.innerWidth - this.props.initialWidth))),
            y: this.props.initialY !== null ? this.props.initialY : Math.max(0, Math.round(0.5 * (window.innerHeight - this.props.initialHeight)))
        };
    }
    render() {
        const dockable = this.props.dockable && ConfigUtils.getConfigProp("globallyDisableDockableDialogs") !== true;
        const initial = {
            ...this.initialPosition(),
            width: this.props.initialWidth,
            height: Math.min(this.props.initialHeight, window.innerHeight - 100)
        };
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

        const content = [
            (<div className="resizeable-window-titlebar" key="titlebar">
                {icon}
                <span className="resizeable-window-titlebar-title">
                    {this.props.title ? (<Message msgId={this.props.title} />) : (this.props.titlelabel || "")}
                </span>
                {(this.props.extraControls || []).map(entry => (
                    <Icon className="resizeable-window-titlebar-control" icon={entry.icon} key={entry.icon} onClick={entry.callback}/>
                ))}
                {dockable ? (
                    <Icon
                        className="resizeable-window-titlebar-control" icon={this.state.dock ? "undock" : "dock"}
                        onClick={() => this.setState({dock: !this.state.dock})}
                        titlemsgid={this.state.dock ? "window.undock" : "window.dock"} />
                ) : null}
                <Icon className="resizeable-window-titlebar-control" icon="remove" onClick={this.onClose} titlemsgid="window.close"/>
            </div>),
            (<div className={bodyclasses} key="body" onMouseDown={this.stopEvent} onMouseUp={this.stopEvent} onTouchStart={this.stopEvent}>
                {this.renderRole("body")}
            </div>)
        ];

        if (this.state.dock && this.props.visible) {
            return (
                <div className="dock-window" onMouseDown={this.startDockResize} ref={c => { this.dock = c; }} style={{zIndex: this.props.zIndex, width: this.props.initialWidth + 'px'}}>
                    {content}
                </div>
            );
        } else {
            return (
                <div className="resizeable-window-container" style={style}>
                    <Rnd bounds="parent" className="resizeable-window" default={initial}
                        maxHeight={this.props.maxHeight || window.innerHeight} maxWidth={this.props.maxWidth || window.innerWidth}
                        minHeight={this.props.minHeight} minWidth={this.props.minWidth}
                        ref={c => { this.rnd = c; }} style={{zIndex: this.props.zIndex}}>
                        {content}
                    </Rnd>
                </div>
            );
        }
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

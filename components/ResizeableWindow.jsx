/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const {Rnd} = require('react-rnd');
const Message = require('../components/I18N/Message');
const Icon = require('./Icon');
require('./style/ResizeableWindow.css');

class ResizeableWindow extends React.Component {
    static propTypes = {
        title: PropTypes.string,
        titlelabel: PropTypes.string,
        icon: PropTypes.string,
        onClose: PropTypes.func,
        scrollable: PropTypes.bool,
        initialX: PropTypes.number,
        initialY: PropTypes.number,
        initialWidth: PropTypes.number,
        initialHeight: PropTypes.number,
        minWidth: PropTypes.number,
        minHeight: PropTypes.number,
        maxWidth: PropTypes.number,
        maxHeight: PropTypes.number,
        extraControls: PropTypes.arrayOf(PropTypes.shape({
            icon: PropTypes.string.isRequired,
            callback: PropTypes.func.isRequired
        })),
        zIndex: PropTypes.number,
        visible: PropTypes.bool,
        initiallyDocked: PropTypes.bool,
        dockable: PropTypes.bool
    }
    static defaultProps = {
        icon: null,
        icon: null,
        initialX: null,
        initialY: null,
        initialWidth: 240,
        initialHeight: 320,
        minWidth: 50,
        minHeight: 50,
        maxWidth: null,
        maxHeight: null,
        onClose: () => {},
        scrollable: false,
        extraControls: null,
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
    }
    componentDidMount() {
        this.setState({dock: this.props.initiallyDocked || false});
    }
    componentWillReceiveProps(newProps) {
        if(this.rnd && newProps.visible && newProps.visible !== this.props.visible) {
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
        let initial = {
            ...this.initialPosition(),
            width: this.props.initialWidth,
            height: Math.min(this.props.initialHeight, window.innerHeight - 100)
        };
        let icon = null;
        if(this.props.icon) {
            icon = (<Icon icon={this.props.icon} className="resizeable-window-titlebar-icon" />);
        }
        let bodyclasses = classnames({
            "resizeable-window-body": true,
            "resizeable-window-body-scrollable": this.props.scrollable,
            "resizeable-window-body-nonscrollable": !this.props.scrollable
        });
        let style = {display: this.props.visible ? 'initial' : 'none'};

        let content = [
            (<div className="resizeable-window-titlebar" key="titlebar">
                {icon}
                <span className="resizeable-window-titlebar-title">
                    {this.props.title ? (<Message msgId={this.props.title} />) : (this.props.titlelabel || "")}
                </span>
                {(this.props.extraControls || []).map(entry => (
                    <Icon key={entry.icon} className="resizeable-window-titlebar-control" onClick={entry.callback} icon={entry.icon}/>
                ))}
                {this.props.dockable ? (<Icon className="resizeable-window-titlebar-control" onClick={() => this.setState({dock: !this.state.dock})} icon={this.state.dock ? "undock" : "dock"} titlemsgid={this.state.dock ? "window.undock" : "window.dock"} />) : null}
                <Icon className="resizeable-window-titlebar-control" onClick={this.onClose} icon="remove" titlemsgid="window.close"/>
            </div>),
            (<div className={bodyclasses} onMouseDown={this.stopEvent} onMouseUp={this.stopEvent} onTouchStart={this.stopEvent} key="body">
                {this.renderRole("body")}
            </div>)
        ];

        if(this.state.dock) {
            return (
                <div className="dock-window" style={{zIndex: this.props.zIndex, width: this.props.initialWidth + 'px'}} onMouseDown={this.startDockResize} ref={c => this.dock = c}>
                    {content}
                </div>
            );
        } else {
            return (
                <div className="resizeable-window-container" style={style}>
                    <Rnd className="resizeable-window" bounds="parent" default={initial}
                        minWidth={this.props.minWidth} minHeight={this.props.minHeight}
                        maxWidth={this.props.maxWidth || window.innerWidth} maxHeight={this.props.maxHeight || window.innerHeight}
                        style={{zIndex: this.props.zIndex}} ref={c => this.rnd = c}>
                        {content}
                    </Rnd>
                </div>
            );
        }
    }
    startDockResize = (ev) => {
        if(ev.target == this.dock) {
            this.dockResizeStartWidth = ev.target.offsetWidth;
            this.dockResizeStartMouse = ev.clientX;
            document.addEventListener("mousemove", this.resizeDock);
            document.addEventListener("mouseup", this.endDockResize);
        }
    }
    endDockResize = (ev) => {
        document.removeEventListener("mousemove", this.resizeDock);
        document.removeEventListener("mouseup", this.endDockResize);
        this.dockResizeStartWidth = undefined;
        this.dockResizeStartMouse = undefined;
    }
    resizeDock = (ev) => {
        if(this.dock) {
            this.dock.style.width = (this.dockResizeStartWidth + ev.clientX - this.dockResizeStartMouse) + 'px';
        }
    }
};

module.exports = ResizeableWindow;

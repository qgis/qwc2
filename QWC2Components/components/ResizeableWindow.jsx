/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const ReactRnd = require('react-rnd');
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
require('./style/ResizeableWindow.css');

const ResizeableWindow = React.createClass({
    propTypes: {
    title: React.PropTypes.string,
    icon: React.PropTypes.string,
    glyphicon: React.PropTypes.string,
    onClose: React.PropTypes.func,
        initialX: React.PropTypes.number,
        initialY: React.PropTypes.number,
        initialWidth: React.PropTypes.number,
        initialHeight: React.PropTypes.number,
        minWidth: React.PropTypes.number,
        minHeight: React.PropTypes.number,
        maxWidth: React.PropTypes.number,
        maxHeight: React.PropTypes.number,
    },
    getDefaultProps() {
        return {
            icon: null,
            glyphicon: null,
            initialX: null,
            initialY: null,
            initialWidth: 240,
            initialHeight: 320,
            minWidth: 50,
            minHeight: 50,
            maxWidth: null,
            maxHeight: null,
            onClose: () => {}
        }
    },
    renderRole(role) {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    },
    killEvent(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    render() {
        let initial = {
            x: this.props.initialX || Math.round(0.5 * (window.innerWidth - this.props.initialWidth)),
            y: this.props.initialY || Math.round(0.5 * (window.innerHeight - this.props.initialHeight)),
            width: 0.8 * this.props.initialWidth,
            height: 0.8 * this.props.initialHeight
        };
        let icon = null;
        if(this.props.glyphicon) {
            icon = (<Glyphicon glyph={this.props.glyphicon} />);
        } else if(this.props.icon) {
            icon = (<img src={this.props.icon} />);
        }
        return (
            <ReactRnd className="resizeable-window" initial={initial}
                minWidth={this.props.minWidth} minHeight={this.props.minHeight}
                maxWidth={this.props.maxWidth || window.innerWidth} maxHeight={this.props.maxHeight || window.innerHeight}>
                <div className="resizeable-window-titlebar">
                    <span className="resizeable-window-titlebar-icon">
                        {icon}
                    </span>
                    <span className="resizeable-window-titlebar-title">
                        <Message msgId={this.props.title} />
                    </span>
                    <Glyphicon className="resizeable-window-titlebar-close" onClick={this.onClose} glyph="remove"/>
                </div>
                <div className="resizeable-window-body" onMouseDown={this.killEvent} onMouseUp={this.killEvent} onTouchStart={this.killEvent}>
                    {this.renderRole("body")}
                </div>
            </ReactRnd>
        );
    },
    onClose(ev) {
        this.props.onClose();
        ev.stopPropagation();
    }
});

module.exports = ResizeableWindow;

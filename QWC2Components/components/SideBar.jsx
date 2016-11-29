/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Swipeable = require('react-swipeable');
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {setCurrentTask} = require("../actions/task");
require('./style/SideBar.css');

const SideBar = React.createClass({
    propTypes: {
        id: React.PropTypes.string.isRequired,
        currentTask: React.PropTypes.string,
        onShow: React.PropTypes.func,
        onHide: React.PropTypes.func,
        width: React.PropTypes.string,
        setCurrentTask: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            currentTask: null,
            onShow: () => {},
            onHide: () => {},
            width: '15em'
        }
    },
    componentWillReceiveProps(newProps) {
        let newVisible = newProps.currentTask === newProps.id;
        let oldVisible = this.props.currentTask === this.props.id;
        if(newVisible && !oldVisible) {
            newProps.onShow();
        } else if(!newVisible && oldVisible) {
            newProps.onHide();
        }
    },
    closeClicked() {
        if(this.props.currentTask === this.props.id) {
            this.props.setCurrentTask(null);
        }
    },
    renderRole(role) {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    },
    render() {
        let visible = this.props.currentTask === this.props.id;
        let style = {
            width: this.props.width,
            right: visible ? 0 : 'calc(-' + this.props.width + ' - 8px)',
            zIndex: visible ? 5 : 4
        }
        let body = null;
        if(visible) {
            body = this.renderRole("body");
        }
        return (
            <Swipeable onSwipedRight={this.closeClicked}>
                <div id={this.props.id} className="sidebar" style={style}>
                    <div className="sidebar-titlebar">{this.renderRole("title")}<Glyphicon onClick={this.closeClicked} glyph="chevron-right"/></div>
                    <div className="sidebar-body">
                        {body}
                    </div>
                </div>
            </Swipeable>
        );
    }
});

const selector = (state) => ({
    currentTask: state.task ? state.task.current : null
});

module.exports = {
    SideBar: connect(selector, {
        setCurrentTask: setCurrentTask,
    })(SideBar)
}

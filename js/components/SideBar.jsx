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
const {setCurrentSidebar} = require("../actions/sidebar");
require('./style/SideBar.css');

const SideBar = React.createClass({
    propTypes: {
        id: React.PropTypes.string.isRequired,
        currentSidebar: React.PropTypes.string,
        onShow: React.PropTypes.func,
        onHide: React.PropTypes.func,
        title: React.PropTypes.string,
        width: React.PropTypes.string
    },
    getDefaultProps() {
        return {
            currentSidebar: null,
            onShow: () => {},
            onHide: () => {},
            width: '15em'
        }
    },
    componentWillReceiveProps(newProps) {
        let newVisible = newProps.currentSidebar === newProps.id;
        let oldVisible = this.props.currentSidebar === this.props.id;
        if(newVisible && !oldVisible) {
            this.props.onShow();
        }
    },
    closeClicked() {
        if(this.props.currentSidebar === this.props.id) {
            this.props.setCurrentSidebar(null);
        }
        this.props.onHide();
    },
    renderRole(role) {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    },
    render() {
        let visible = this.props.currentSidebar === this.props.id;
        let style = {
            width: this.props.width,
            right: visible ? 0 : '-' + this.props.width
        }
        let body = null;
        if(visible) {
            body = this.renderRole("body");
        }
        return (
            <Swipeable onSwipedRight={this.closeClicked}>
                <div id={this.props.id} className="sidebar" style={style}>
                    <div className="sidebar-title"><Message msgId={this.props.title} /><Glyphicon onClick={this.closeClicked} glyph="remove"/></div>
                    {body}
                </div>
            </Swipeable>
        );
    }
});

const selector = (state) => ({
    currentSidebar: state.sidebar ? state.sidebar.current : null
});

module.exports = {
    SideBar: connect(selector, {
        setCurrentSidebar: setCurrentSidebar,
    })(SideBar)
}

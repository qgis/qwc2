/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const ResizeableWindow = require('./ResizeableWindow');
const {MessageBar} = require('./MessageBar');
const {closeWindow} = require('../actions/windows');

require('./style/WindowManager.css');

class WindowManager extends React.Component {
    static propTypes = {
        windows: PropTypes.object,
        closeWindow: PropTypes.func
    }
    render() {
        return Object.entries(this.props.windows).map(([key, data]) => {
            if(data.type === "iframedialog") {
                return this.renderIframeDialog(key, data);
            } else if(data.type === "notification") {
                return this.renderNotification(key, data);
            } else {
                return null;
            }
        });
    }
    renderIframeDialog = (key, data) => {
        return (
            <ResizeableWindow key={key} title={"windows." + key} icon={data.icon || ""} initialWidth={640} initialHeight={480} onClose={() => this.props.closeWindow(key)}>
                <iframe className="windows-iframe-dialog-body" role="body" src={data.url} />
            </ResizeableWindow>
        );
    }
    renderNotification = (key, data) => {
        return (
            <MessageBar key={key} onHide={() => this.props.closeWindow(key)} hideOnTaskChange={true}>
                <span role="body">{data.text}</span>
            </MessageBar>
        );
    }
}

const selector = (state) => ({
    windows: state.windows
});

module.exports = connect(selector, {
    closeWindow: closeWindow
})(WindowManager);

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
const {closeWindow, closeAllWindows} = require('../actions/windows');

require('./style/WindowManager.css');

class WindowManager extends React.Component {
    static propTypes = {
        closeAllWindows: PropTypes.func,
        closeWindow: PropTypes.func,
        currentTheme: PropTypes.object,
        windows: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.iframes = {};
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.currentTheme !== prevProps.currentTheme) {
            this.props.closeAllWindows();
        }
    }
    render() {
        return Object.entries(this.props.windows).map(([key, data]) => {
            if (data.type === "iframedialog") {
                return this.renderIframeDialog(key, data);
            } else if (data.type === "notification") {
                return this.renderNotification(key, data);
            } else {
                return null;
            }
        });
    }
    renderIframeDialog = (key, data) => {
        const extraControls = [];
        if (data.options.print) {
            extraControls.push({icon: "print", callback: () => this.printIframe(key)});
        }
        return (
            <ResizeableWindow extraControls={extraControls} icon={data.icon || ""} initialHeight={data.options.h || 480}
                initialWidth={data.options.w || 640} key={key}
                onClose={() => this.closeWindow(key)}
                title={"windows." + key}>
                <iframe className="windows-iframe-dialog-body" onLoad={(ev) => { this.iframes[key] = ev.target; }} role="body" src={data.url} />
            </ResizeableWindow>
        );
    }
    renderNotification = (key, data) => {
        return (
            <MessageBar hideOnTaskChange key={key} onHide={() => this.closeWindow(key)}>
                <span role="body">{data.text}</span>
            </MessageBar>
        );
    }
    closeWindow = (key) => {
        delete this.iframes[key];
        this.props.closeWindow(key);
    }
    printIframe = (key) => {
        if (this.iframes[key]) {
            this.iframes[key].contentWindow.print();
        }
    }
}

const selector = (state) => ({
    windows: state.windows,
    currentTheme: state.theme.current
});

module.exports = connect(selector, {
    closeWindow: closeWindow,
    closeAllWindows: closeAllWindows
})(WindowManager);

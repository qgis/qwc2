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
        windows: PropTypes.object,
        currentTheme: PropTypes.object,
        closeWindow: PropTypes.func,
        closeAllWindows: PropTypes.func
    }
    constructor(props) {
        super(props);
        this.iframes = {};
    }
    componentWillReceiveProps(newProps) {
        if(newProps.currentTheme !== this.props.currentTheme) {
            this.props.closeAllWindows();
        }
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
        let extraControls = [];
        if(data.options.print) {
            extraControls.push({icon: "print", callback: () => this.printIframe(key)});
        }
        return (
            <ResizeableWindow key={key} title={"windows." + key} icon={data.icon || ""}
                initialWidth={data.options.w || 640} initialHeight={data.options.h || 480}
                onClose={() => this.closeWindow(key)}
                extraControls={extraControls}>
                <iframe onLoad={(ev) => this.iframes[key] = ev.target} className="windows-iframe-dialog-body" role="body" src={data.url} />
            </ResizeableWindow>
        );
    }
    renderNotification = (key, data) => {
        return (
            <MessageBar key={key} onHide={() => this.closeWindow(key)} hideOnTaskChange={true}>
                <span role="body">{data.text}</span>
            </MessageBar>
        );
    }
    closeWindow = (key) => {
        delete this.refs[key];
        this.props.closeWindow(key);
    }
    printIframe = (key) => {
        if(this.iframes[key]) {
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

/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import ResizeableWindow from './ResizeableWindow';
import MessageBar from './MessageBar';
import {closeWindow, closeAllWindows} from '../actions/windows';

import './style/WindowManager.css';

class WindowManager extends React.Component {
    static propTypes = {
        closeAllWindows: PropTypes.func,
        closeWindow: PropTypes.func,
        currentTheme: PropTypes.object,
        windows: PropTypes.object
    };
    componentDidUpdate(prevProps) {
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
        if (this.boolVal(data.options.print, true) !== false) {
            extraControls.push({icon: "print", callback: () => this.printIframe(key)});
        }
        const dockable = this.boolVal(data.options.dockable) !== false;
        const docked = this.boolVal(data.options.docked) !== false;
        return (
            <ResizeableWindow dockable={dockable || docked} extraControls={extraControls} icon={data.options.icon || ""}
                initialHeight={data.options.h || 480}
                initialWidth={data.options.w || 640}
                initiallyDocked={docked} key={key}
                onClose={() => this.closeWindow(key)}
                title={data.options.title || "windows." + key}>
                <iframe className="windows-iframe-dialog-body" name={key} role="body" src={data.url} />
            </ResizeableWindow>
        );
    };
    renderNotification = (key, data) => {
        return (
            <MessageBar hideOnTaskChange key={key} onHide={() => this.closeWindow(key)}>
                <span role="body">{data.text}</span>
            </MessageBar>
        );
    };
    closeWindow = (key) => {
        this.props.closeWindow(key);
    };
    printIframe = (key) => {
        if (window.frames[key]) {
            window.frames[key].focus();
            window.frames[key].print();
        }
    };
    boolVal = (value, delft = false) => {
        if (value === undefined || value === null) {
            return delft;
        }
        const textVal = ("" + value).toLowerCase();
        if (textVal === "") {
            return delft;
        }
        return ["0", "false"].includes(textVal) ? false : true;
    };
    get = (obj, key, deflt) => {
        if (obj[key] === undefined) {
            return deflt;
        }
        return obj[key];
    };
}

const selector = (state) => ({
    windows: state.windows.entries,
    currentTheme: state.theme.current
});

export default connect(selector, {
    closeWindow: closeWindow,
    closeAllWindows: closeAllWindows
})(WindowManager);

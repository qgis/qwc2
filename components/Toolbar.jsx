/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import LocaleUtils from '../utils/LocaleUtils';
import {setCurrentTask, openExternalUrl} from '../actions/task';
import Icon from './Icon';
import './style/Toolbar.css';

class Toolbar extends React.Component {
    static propTypes = {
        currentTask: PropTypes.string,
        currentTaskMode: PropTypes.string,
        currentTheme: PropTypes.object,
        openExternalUrl: PropTypes.func,
        setCurrentTask: PropTypes.func,
        toolbarItems: PropTypes.array
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    renderToolbarItem = (item) => {
        if (item.themeWhitelist && !item.themeWhitelist.includes(this.props.currentTheme.title)) {
            return null;
        }
        const active = this.props.currentTask == (item.task || item.key) && this.props.currentTaskMode == item.mode;
        const title = LocaleUtils.getMessageById(this.context.messages, "appmenu.items." + item.key) || null;
        return (
            <Icon
                className={active ? "toolbar-item-active" : ""}
                icon={item.icon}
                key={item.key + item.mode}
                onClick={() => this.itemClicked(item, active)}
                size="xlarge"
                title={title}
            />
        );
    }
    itemClicked = (item, active) => {
        if (item.url) {
            this.props.openExternalUrl(item.url);
        } else if (active) {
            this.props.setCurrentTask(null);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    }
    render() {
        return (
            <span id="Toolbar">
                {this.props.toolbarItems.map(this.renderToolbarItem)}
            </span>
        );
    }
}

export default connect((state) => ({
    currentTask: state.task ? state.task.id : "",
    currentTaskMode: state.task ? state.task.mode : "",
    currentTheme: state.theme.current || {}
}), {
    setCurrentTask: setCurrentTask,
    openExternalUrl: openExternalUrl
})(Toolbar);

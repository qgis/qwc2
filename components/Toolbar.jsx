/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import Mousetrap from 'mousetrap';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import Icon from './Icon';

import './style/Toolbar.css';

class Toolbar extends React.Component {
    static propTypes = {
        currentTask: PropTypes.string,
        currentTaskMode: PropTypes.string,
        currentTheme: PropTypes.object,
        openExternalUrl: PropTypes.func,
        setCurrentTask: PropTypes.func,
        toolbarItems: PropTypes.array,
        toolbarItemsShortcutPrefix: PropTypes.string
    };
    constructor(props) {
        super(props);
        this.boundShortcuts = [];
    }
    componentDidUpdate(prevProps) {
        if (this.props.currentTheme !== prevProps.currentTheme) {
            this.boundShortcuts.forEach(shortcut => Mousetrap.unbind(shortcut));
            this.boundShortcuts = [];
            if (this.props.toolbarItemsShortcutPrefix) {
                let index = 1;
                this.props.toolbarItems.forEach(item => {
                    if (this.itemAllowed(item)) {
                        const shortcut = this.props.toolbarItemsShortcutPrefix + '+' + index;
                        Mousetrap.bind(shortcut, () => {
                            const active = this.props.currentTask === (item.task || item.key) && this.props.currentTaskMode === (item.mode || null);
                            this.itemClicked(item, active);
                            return false;
                        });
                        this.boundShortcuts.push(shortcut);
                        index += 1;
                    }
                });
            }
        }
    }
    renderToolbarItem = (item) => {
        if (!this.itemAllowed(item)) {
            return null;
        }
        const active = this.props.currentTask === (item.task || item.key) && this.props.currentTaskMode === (item.mode || null);
        const title = LocaleUtils.tr("appmenu.items." + item.key + (item.mode || ""));
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
    };
    itemAllowed = (item) => {
        if (item.themeBlacklist && (item.themeBlacklist.includes(this.props.currentTheme.title) || item.themeBlacklist.includes(this.props.currentTheme.name))) {
            return false;
        }
        if (item.themeWhitelist && !(item.themeWhitelist.includes(this.props.currentTheme.title) || item.themeWhitelist.includes(this.props.currentTheme.name))) {
            return false;
        }
        if (item.requireAuth && !ConfigUtils.getConfigProp("username")) {
            return false;
        }
        return true;
    };
    itemClicked = (item, active) => {
        if (item.url) {
            this.props.openExternalUrl(item.url, item.target, LocaleUtils.tr("appmenu.items." + item.key), item.icon);
        } else if (active) {
            this.props.setCurrentTask(null);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    };
    render() {
        return (
            <div className="Toolbar">
                {this.props.toolbarItems.map(this.renderToolbarItem)}
            </div>
        );
    }
}

export default connect((state) => ({
    currentTask: state.task.id,
    currentTaskMode: state.task.mode,
    currentTheme: state.theme.current || {}
}), {
    setCurrentTask: setCurrentTask
})(Toolbar);

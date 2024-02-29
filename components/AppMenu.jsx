/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import mousetrap from 'mousetrap';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import {setMenuMargin} from '../actions/windows';
import InputContainer from '../components/InputContainer';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import ThemeUtils from '../utils/ThemeUtils';
import Icon from './Icon';

import './style/AppMenu.css';


class AppMenu extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        appMenuShortcut: PropTypes.string,
        buttonContents: PropTypes.object,
        currentTaskBlocked: PropTypes.bool,
        currentTheme: PropTypes.object,
        keepMenuOpen: PropTypes.bool,
        menuCompact: PropTypes.bool,
        menuItems: PropTypes.array,
        onMenuToggled: PropTypes.func,
        openExternalUrl: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setMenuMargin: PropTypes.func,
        showFilterField: PropTypes.bool,
        showOnStartup: PropTypes.bool
    };
    static defaultProps = {
        onMenuToggled: () => {}
    };
    state = {
        menuVisible: false,
        filter: "",
        submenusVisible: [],
        curEntry: null,
        keyNav: false
    };
    constructor(props) {
        super(props);
        this.menuEl = null;
        this.filterfield = null;
        this.boundShortcuts = [];
    }
    componentDidMount() {
        if (this.props.showOnStartup) {
            this.toggleMenu();
        }
        this.addKeyBindings(this.props.menuItems);
        if (this.props.appMenuShortcut) {
            mousetrap.bind(this.props.appMenuShortcut, this.toggleMenu);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.menuVisible && !prevState.menuVisible && this.filterfield && !this.props.menuCompact) {
            // Need to wait until slide in transition is over
            setTimeout(() => { this.filterfield.focus(); }, 400);
        }
    }
    componentWillUnmount() {
        this.boundShortcuts.forEach(shortcut => mousetrap.unbind(shortcut));
        if (this.props.appMenuShortcut) {
            mousetrap.unbind(this.props.appMenuShortcut, this.toggleMenu);
        }
        if (this.state.menuVisible) {
            document.removeEventListener('click', this.checkCloseMenu);
            document.removeEventListener('keydown', this.onKeyPress, true);
            document.removeEventListener('mousemove', this.onMouseMove, true);
        }
    }
    addKeyBindings = (items) => {
        items.forEach(item => {
            if (item.subitems) {
                this.addKeyBindings(item.subitems);
            } else if (item.shortcut) {
                mousetrap.bind(item.shortcut, () => {
                    if (this.itemAllowed(item)) {
                        this.onMenuitemClicked(item);
                    }
                    return false;
                });
                this.boundShortcuts.push(item.shortcut);
            }
        });
    };
    onKeyPress = (ev) => {
        if (ev.keyCode === 13 || ev.keyCode === 37 || ev.keyCode === 38 || ev.keyCode === 39 || ev.keyCode === 40) {
            if (!this.state.curEntry) {
                if (ev.keyCode === 38 || ev.keyCode === 40) {
                    this.setState({curEntry: [ev.keyCode === 38 ? this.props.menuItems.length - 1 : 0]});
                }
            } else {
                const curEntry = [...this.state.curEntry];
                const stack = [this.props.menuItems];
                this.state.curEntry.forEach(entry => {
                    stack.push(stack[stack.length - 1][entry].subitems);
                });
                stack.pop();
                let leaf = curEntry.pop();
                const level = stack.length - 1;
                if (ev.keyCode === 13) { // Enter
                    if (!isEmpty(stack[stack.length - 1][leaf].subitems)) {
                        this.onSubmenuClicked(stack[stack.length - 1][leaf].key, level);
                    } else {
                        this.onMenuitemClicked(stack[stack.length - 1][leaf]);
                    }
                } else if (ev.keyCode === 37) { // Left
                    if (!isEmpty(stack[stack.length - 1][leaf].subitems) && this.state.submenusVisible[level] === stack[stack.length - 1][leaf].key) {
                        this.onSubmenuClicked(stack[stack.length - 1][leaf].key, level);
                    }
                } else if (ev.keyCode === 38) { // Up
                    leaf -= 1;
                    if (leaf >= 0 && !isEmpty(stack[stack.length - 1][leaf].subitems) && this.state.submenusVisible[level] === stack[stack.length - 1][leaf].key) {
                        curEntry.push(leaf);
                        leaf = stack[stack.length - 1][leaf].subitems.length - 1;
                    } else {
                        while (leaf < 0 && curEntry.length > 0) {
                            leaf = curEntry.pop();
                        }
                        if (leaf < 0) {
                            leaf = this.props.menuItems.length - 1;
                        }
                    }
                } else if (ev.keyCode === 39) { // Right
                    if (!isEmpty(stack[stack.length - 1][leaf].subitems) && !this.state.submenusVisible[level]) {
                        this.onSubmenuClicked(stack[stack.length - 1][leaf].key, level);
                    }
                } else if (ev.keyCode === 40) { // Down
                    if (!isEmpty(stack[stack.length - 1][leaf].subitems) && this.state.submenusVisible[level] === stack[stack.length - 1][leaf].key) {
                        curEntry.push(leaf);
                        leaf = 0;
                    } else {
                        leaf += 1;
                        while (leaf > stack[stack.length - 1].length - 1 && curEntry.length > 0) {
                            leaf = curEntry.pop() + 1;
                            stack.pop();
                        }
                        if (leaf > this.props.menuItems.length - 1) {
                            leaf = 0;
                        }
                    }
                }
                this.setState({curEntry: [...curEntry, leaf], keyNav: true});
            }
            MiscUtils.killEvent(ev);
        } else if (ev.keyCode === 27) {
            this.toggleMenu();
            MiscUtils.killEvent(ev);
        }
    };
    onMouseMove = () => {
        if (this.state.keyNav) {
            this.setState({keyNav: false});
        }
    };
    toggleMenu = () => {
        if (!this.state.menuVisible && this.props.currentTaskBlocked) {
            return;
        }
        if (!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        if (!this.props.keepMenuOpen) {
            if (!this.state.menuVisible) {
                document.addEventListener('click', this.checkCloseMenu);
                document.addEventListener('keydown', this.onKeyPress, true);
                document.addEventListener('mousemove', this.onMouseMove, true);
            } else {
                document.removeEventListener('click', this.checkCloseMenu);
                document.removeEventListener('keydown', this.onKeyPress, true);
                document.removeEventListener('mousemove', this.onMouseMove, true);
            }
        }
        this.props.onMenuToggled(!this.state.menuVisible);
        if (this.props.menuCompact) {
            this.props.setMenuMargin(!this.state.menuVisible ? MiscUtils.convertEmToPx(3.75) : 0, 0);
        }
        this.setState((state) => ({menuVisible: !state.menuVisible, submenusVisible: [], filter: ""}));
    };
    checkCloseMenu = (ev) => {
        if (this.menuEl && !this.menuEl.contains(ev.target) && !this.props.keepMenuOpen) {
            this.toggleMenu();
        }
    };
    onSubmenuClicked = (key, level) => {
        const a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState((state) => ({submenusVisible: state.submenusVisible.slice(0, level).concat(a)}));
    };
    onMenuitemClicked = (item) => {
        if (!this.props.keepMenuOpen && this.state.menuVisible) {
            this.toggleMenu();
        }
        if (item.url) {
            this.props.openExternalUrl(item.url, item.target, LocaleUtils.tr("appmenu.items." + item.key), item.icon);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    };
    renderMenuItems = (items, level, filter, path) => {
        if (items) {
            return items.map((item, idx) => {
                if (!this.itemAllowed(item)) {
                    return null;
                }
                const active = isEqual(this.state.curEntry, [...path, idx]);
                if (item.subitems) {
                    const subitems = this.renderMenuItems(item.subitems, level + 1, filter, [...path, idx]);
                    if (filter && isEmpty(subitems)) {
                        return null;
                    }
                    const visible = (filter && !isEmpty(subitems)) || this.state.submenusVisible[level] === item.key;
                    const className = classnames({
                        "appmenu-submenu": true,
                        "appmenu-submenu-active": active,
                        "appmenu-submenu-expanded": visible
                    });
                    return (
                        <li className={className} key={item.key}
                            onClick={() => this.onSubmenuClicked(item.key, level)}
                            onMouseEnter={() => { if (!this.state.keyNav) { this.setState({curEntry: [...path, idx]}); } } }
                            onMouseLeave={() => { if (!this.state.keyNav) { this.setState({curEntry: null}); } } }
                            ref={el => { if (active && el && this.state.keyNav) { el.scrollIntoView(false); } }}
                        >
                            <Icon icon={item.icon} size="xlarge"/>
                            {item.title ? LocaleUtils.tr(item.title) : LocaleUtils.tr("appmenu.items." + item.key)}
                            <ul>
                                {subitems}
                            </ul>
                        </li>
                    );
                } else {
                    const label = item.title ? LocaleUtils.tr(item.title) : LocaleUtils.tr("appmenu.items." + item.key + (item.mode || ""));
                    const comment = item.comment ? LocaleUtils.tr("appmenu.items." + item.key + (item.mode || "") + "_comment") : "";
                    if (!filter || removeDiacritics(label.toLowerCase()).match(filter) || (comment && removeDiacritics(comment.toLowerCase()).match(filter))) {
                        const className = classnames({
                            "appmenu-leaf": true,
                            "appmenu-leaf-active": active
                        });
                        return (
                            <li className={className} key={item.key + (item.mode || "")}
                                onClick={() => this.onMenuitemClicked(item)}
                                onMouseEnter={() => { if (!this.state.keyNav) { this.setState({curEntry: [...path, idx]}); } } }
                                onMouseLeave={() => { if (!this.state.keyNav) { this.setState({curEntry: null}); } } }
                                ref={el => { if (active && el && this.state.keyNav) { el.scrollIntoView(false); } }}
                            >
                                <Icon icon={item.icon} size="xlarge"/>
                                <span className="appmenu-leaf-label">
                                    {label}
                                    {comment ? (<div className="appmenu-leaf-comment">{comment}</div>) : null}
                                </span>
                            </li>
                        );
                    }
                    return null;
                }
            }).filter(x => x);
        } else {
            return null;
        }
    };
    render() {
        const visible = !this.props.currentTaskBlocked && this.state.menuVisible;
        const className = classnames({
            "appmenu-blocked": this.props.currentTaskBlocked,
            "appmenu-visible": visible,
            "appmenu-compact": this.props.menuCompact
        });
        const filter = removeDiacritics(this.state.filter.toLowerCase());
        return (
            <div className={"AppMenu " + className} ref={el => { this.menuEl = el; MiscUtils.setupKillTouchEvents(el); }}
            >
                <div className="appmenu-button-container" onMouseDown={this.toggleMenu} >
                    {this.props.buttonContents}
                </div>
                <div className="appmenu-menu-container">
                    <ul className="appmenu-menu">
                        {this.props.showFilterField ? (
                            <li className="appmenu-leaf">
                                <Icon icon={"search"} size="xlarge"/>
                                <InputContainer className="appmenu-filter">
                                    <input onChange={ev => this.setState({filter: ev.target.value, curEntry: null})}
                                        placeholder={LocaleUtils.tr("appmenu.filter")} ref={this.setFilterField}
                                        role="input"
                                        type="text"
                                        value={this.state.filter}/>
                                    <Icon icon="clear" onClick={() => this.setState({filter: ""})} role="suffix" />
                                </InputContainer>
                            </li>
                        ) : null}
                        {this.renderMenuItems(this.props.menuItems, 0, filter, [])}
                    </ul>
                </div>
            </div>
        );
    }
    setFilterField = (el) => {
        this.filterfield = el;
        if (this.props.appMenuShortcut) {
            mousetrap(el).bind(this.props.appMenuShortcut, this.toggleMenu);
        }
    };
    itemAllowed = (item) => {
        if (!ThemeUtils.themFlagsAllowed(this.props.currentTheme, item.themeFlagWhitelist, item. themeFlagBlacklist)) {
            return false;
        }
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
}

export default connect((state) => ({
    currentTaskBlocked: state.task.blocked,
    currentTheme: state.theme.current || {}
}), {
    setCurrentTask: setCurrentTask,
    setMenuMargin: setMenuMargin
})(AppMenu);

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
import mousetrap from 'mousetrap';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import {setMenuMargin} from '../actions/windows';
import InputContainer from '../components/widgets/InputContainer';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';

import './style/AppMenu.css';


class AppMenu extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        appMenuShortcut: PropTypes.string,
        buttonLabel: PropTypes.string,
        currentTaskBlocked: PropTypes.bool,
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
        submenusVisible: []
    };
    constructor(props) {
        super(props);
        this.menuBtn = null;
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
        if (this.state.menuVisible && !prevState.menuVisible && !this.props.menuCompact) {
            // Need to wait until slide in transition is over
            setTimeout(() => { this.filterfield?.focus?.(); }, 400);
            // Delay one cycle
            setTimeout(() => document.addEventListener('click', this.checkCloseMenu), 0);
        } else if (prevState.menuVisible && !this.state.menuVisible && !this.props.menuCompact) {
            document.removeEventListener('click', this.checkCloseMenu);
        }
    }
    componentWillUnmount() {
        this.boundShortcuts.forEach(shortcut => mousetrap.unbind(shortcut));
        if (this.props.appMenuShortcut) {
            mousetrap.unbind(this.props.appMenuShortcut, this.toggleMenu);
        }
        document.removeEventListener('click', this.checkCloseMenu);
    }
    addKeyBindings = (items) => {
        items.forEach(item => {
            if (item.subitems) {
                this.addKeyBindings(item.subitems);
            } else if (item.shortcut) {
                mousetrap.bind(item.shortcut, () => {
                    this.onMenuitemClicked(item);
                    return false;
                });
                this.boundShortcuts.push(item.shortcut);
            }
        });
    };
    toggleMenu = () => {
        if (!this.state.menuVisible && this.props.currentTaskBlocked) {
            return;
        }
        if (!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
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
            MiscUtils.killEvent(ev);
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
            const label = item.title ? LocaleUtils.tr(item.title) : LocaleUtils.tr("appmenu.items." + item.key + (item.mode || ""));
            this.props.openExternalUrl(item.url, item.target, label, item.icon);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    };
    renderMenuItems = (items, level, filter, submenu = false) => {
        return (items || []).map(item => {
            if (item.subitems) {
                const expanded = filter || this.state.submenusVisible[level] === item.key;
                const subitems = expanded ? this.renderMenuItems(item.subitems, level + 1, filter, true) : null;
                if (filter && isEmpty(subitems)) {
                    return null;
                }
                const className = classnames({
                    "appmenu-menu-item": true,
                    "appmenu-submenu": true,
                    "appmenu-submenu-expanded": expanded
                });
                return [(
                    <div className={className} key={item.key ?? item.title}
                        onClick={() => this.onSubmenuClicked(item.key, level)}
                        onKeyDown={this.keyNav}
                        onMouseOver={ev => ev.target.focus()}
                        tabIndex={0}
                    >
                        <Icon icon={item.icon} size="xlarge"/>
                        {item.title ? LocaleUtils.tr(item.title) : LocaleUtils.tr("appmenu.items." + item.key)}
                    </div>
                ),
                subitems];
            } else {
                const trargs = item.trargs || [];
                const label = item.title ? LocaleUtils.tr(item.title, ...trargs) : LocaleUtils.tr("appmenu.items." + item.key + (item.mode || ""), ...trargs);
                const comment = item.comment ? LocaleUtils.tr("appmenu.items." + item.key + (item.mode || "") + "_comment", ...trargs) : "";
                if (!filter || removeDiacritics(label.toLowerCase()).match(filter) || (comment && removeDiacritics(comment.toLowerCase()).match(filter))) {
                    const className = classnames({
                        "appmenu-menu-item": true,
                        "appmenu-menu-item-nested": submenu
                    });
                    return (
                        <div className={className} key={item.key ? item.key + (item.mode || "") : item.title}
                            onClick={() => this.onMenuitemClicked(item)}
                            onKeyDown={this.keyNav}
                            onMouseOver={ev => ev.target.focus()}
                            tabIndex={0}
                        >
                            <Icon icon={item.icon} size="xlarge"/>
                            <span className="appmenu-menu-item-label">
                                {label}
                                {comment ? (<div className="appmenu-menu-item-comment">{comment}</div>) : null}
                            </span>
                        </div>
                    );
                }
                return null;
            }
        });
    };
    render() {
        const isMobile = ConfigUtils.isMobile();
        const visible = !this.props.currentTaskBlocked && this.state.menuVisible;
        const showLabel = !this.props.menuCompact && !isMobile;
        const className = classnames({
            "AppMenu": true,
            "appmenu-blocked": this.props.currentTaskBlocked,
            "appmenu-visible": visible,
            "appmenu-compact": this.props.menuCompact,
            "appmenu-nolabel": !showLabel
        });
        const filter = this.state.filter ? new RegExp(removeDiacritics(this.state.filter).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i") : null;
        return (
            <div className={className}>
                <div
                    className="appmenu-button" onClick={this.toggleMenu} onKeyDown={this.btnKeyNav}
                    ref={el => { this.menuBtn = el; }} tabIndex={0} title={this.props.buttonLabel}
                >
                    {showLabel ? (<span className="appmenu-label">{this.props.buttonLabel}</span>) : null}
                    <span className="appmenu-icon">
                        <Icon icon="menu-hamburger"/>
                    </span>
                </div>
                <div className="appmenu-menu-container" tabIndex={-1}>
                    <div className="appmenu-menu" inert={visible ? undefined : "true"} onMouseLeave={this.clearFocus} ref={el => { this.menuEl = el; MiscUtils.setupKillTouchEvents(el); }}>
                        {this.props.showFilterField ? (
                            <div
                                className="appmenu-menu-item appmenu-menu-item-filter"
                                onFocus={this.focusFilterField}
                                onKeyDown={this.keyNav}
                                onMouseOver={ev => ev.target.focus()}
                                tabIndex={0}
                            >
                                <Icon icon={"search"} size="xlarge"/>
                                <InputContainer>
                                    <input onChange={ev => this.setState({filter: ev.target.value, curEntry: null})}
                                        placeholder={LocaleUtils.tr("appmenu.filter")} ref={this.setFilterField}
                                        role="input"
                                        type="text"
                                        value={this.state.filter}/>
                                    <Icon icon="clear" onClick={() => this.setState({filter: ""})} role="suffix" />
                                </InputContainer>
                            </div>
                        ) : null}
                        {this.renderMenuItems(this.props.menuItems, 0, filter)}
                    </div>
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
    focusFilterField = (ev) => {
        if (ev.target.classList.contains("appmenu-menu-item-filter")) {
            this.filterfield?.focus?.();
        }
    };
    clearFocus = () => {
        document.activeElement.blur();
    };
    btnKeyNav = (ev) => {
        if (ev.key === 'ArrowDown') {
            this.menuEl.children[0]?.focus();
        } else if (ev.key === 'ArrowUp') {
            this.menuEl.children[this.menuEl.children.length - 1]?.focus();
        } else {
            MiscUtils.checkKeyActivate(ev);
        }
    };
    keyNav = (ev) => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            const childCount = this.menuEl.children.length;
            const delta = ev.key === 'ArrowUp' ? -1 : 1;
            let currentIndex = Array.from(this.menuEl.children).findIndex(el => document.activeElement === el || el.contains(document.activeElement));
            if (currentIndex === -1) {
                currentIndex = delta === 1 ? childCount - 1 : 0;
            }
            const next = (currentIndex + childCount + delta) % childCount;
            this.menuEl.children[next].focus();
            MiscUtils.killEvent(ev);
        } else if (ev.key === 'Escape') {
            if (!this.props.menuCompact) {
                this.toggleMenu();
            }
            this.menuBtn?.focus?.();
            MiscUtils.killEvent(ev);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            if (ev.target.classList.contains("appmenu-menu-item")) {
                ev.target.click();
                MiscUtils.killEvent(ev);
            }
        }
    };
}

export default connect((state) => ({
    currentTaskBlocked: state.task.blocked
}), {
    setCurrentTask: setCurrentTask,
    setMenuMargin: setMenuMargin
})(AppMenu);

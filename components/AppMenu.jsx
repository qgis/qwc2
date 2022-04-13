/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import {setCurrentTask} from '../actions/task';
import LocaleUtils from '../utils/LocaleUtils';
import ConfigUtils from '../utils/ConfigUtils';
import Icon from './Icon';
import './style/AppMenu.css';


class AppMenu extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        buttonContents: PropTypes.object,
        currentTaskBlocked: PropTypes.bool,
        currentTheme: PropTypes.object,
        keepMenuOpen: PropTypes.bool,
        menuItems: PropTypes.array,
        onMenuToggled: PropTypes.func,
        openExternalUrl: PropTypes.func,
        setCurrentTask: PropTypes.func,
        showFilterField: PropTypes.bool,
        showOnStartup: PropTypes.bool
    }
    static defaultProps = {
        onMenuToggled: () => {}
    }
    state = {
        menuVisible: false,
        filter: "",
        submenusVisible: []
    }
    constructor(props) {
        super(props);
        this.menuEl = null;
        this.filterfield = null;
    }
    componentDidMount() {
        if (this.props.showOnStartup) {
            this.toggleMenu();
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.menuVisible && !prevState.menuVisible && this.filterfield) {
            // Need to wait until slide in transition is over
            setTimeout(() => { this.filterfield.focus(); }, 400);
        }
    }
    toggleMenu = () => {
        if (!this.state.menuVisible && this.props.currentTaskBlocked) {
            return;
        }
        if (!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        if (!this.state.menuVisible) {
            document.addEventListener('click', this.checkCloseMenu);
        } else {
            document.removeEventListener('click', this.checkCloseMenu);
        }
        this.props.onMenuToggled(!this.state.menuVisible);
        this.setState({ menuVisible: !this.state.menuVisible, submenusVisible: [], filter: "" });
    }
    checkCloseMenu = (ev) => {
        if (this.menuEl && !this.menuEl.contains(ev.target) && !this.props.keepMenuOpen) {
            this.toggleMenu();
        }
    }
    onSubmenuClicked = (key, level) => {
        const a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState({ submenusVisible: this.state.submenusVisible.slice(0, level).concat(a) });
    }
    onMenuitemClicked = (item) => {
        if (!this.props.keepMenuOpen) {
            this.toggleMenu();
        }
        if (item.url) {
            this.props.openExternalUrl(item.url, item.target, LocaleUtils.tr("appmenu.items." + item.key));
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    }
    renderMenuItems = (items, level, filter) => {
        if (items) {
            return items.map(item => {
                if (item.themeWhitelist && !(item.themeWhitelist.includes(this.props.currentTheme.title) || item.themeWhitelist.includes(this.props.currentTheme.name))) {
                    return null;
                }
                if (item.requireAuth && !ConfigUtils.getConfigProp("username")) {
                    return null;
                }
                if (item.subitems) {
                    const subitems = this.renderMenuItems(item.subitems, level + 1, filter);
                    if (filter && isEmpty(subitems)) {
                        return null;
                    }
                    const visible = (filter && !isEmpty(subitems)) || this.state.submenusVisible[level] === item.key;
                    return (
                        <li className={visible ? "expanded" : ""}
                            key={item.key}
                            onClick={() => this.onSubmenuClicked(item.key, level)}
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
                        return (
                            <li className="appmenu-leaf" key={item.key + (item.mode || "")} onClick={() => this.onMenuitemClicked(item)} >
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
    }
    render() {
        let className = "";
        if (this.props.currentTaskBlocked) {
            className = "appmenu-blocked";
        } else if (this.state.menuVisible) {
            className = "appmenu-visible";
        }
        const filter = removeDiacritics(this.state.filter.toLowerCase());
        return (
            <div className={"AppMenu " + className} ref={el => { this.menuEl = el; }}
            >
                <div className="appmenu-button-container" onMouseDown={this.toggleMenu}>
                    {this.props.buttonContents}
                </div>
                <div className="appmenu-menu-container">
                    <ul className="appmenu-menu">
                        {this.props.showFilterField ? (
                            <li className="appmenu-leaf">
                                <Icon icon={"search"} size="xlarge"/>
                                <div className="appmenu-filter">
                                    <input onChange={ev => this.setState({filter: ev.target.value})}
                                        placeholder={LocaleUtils.tr("appmenu.filter")} ref={el => {this.filterfield = el; }}
                                        type="text"
                                        value={this.state.filter}/>
                                    <Icon icon="remove" onClick={() => this.setState({filter: ""})} />
                                </div>
                            </li>
                        ) : null}
                        {this.renderMenuItems(this.props.menuItems, 0, filter)}
                    </ul>
                </div>
            </div>
        );
    }
}

export default connect((state) => ({
    currentTaskBlocked: state.task.blocked,
    currentTheme: state.theme.current || {}
}), {
    setCurrentTask: setCurrentTask
})(AppMenu);

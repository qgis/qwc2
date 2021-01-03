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
import {Swipeable} from 'react-swipeable';
import Message from '../components/I18N/Message';
import {setCurrentTask} from '../actions/task';
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
        showOnStartup: PropTypes.bool
    }
    static defaultProps = {
        onMenuToggled: () => {}
    }
    state = {
        menuVisible: false,
        submenusVisible: []
    }
    constructor(props) {
        super(props);
        this.menuEl = null;
    }
    componentDidMount() {
        if (this.props.showOnStartup) {
            this.toggleMenu();
        }
    }
    toggleMenu = () => {
        if (!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        if (!this.state.menuVisible) {
            document.addEventListener('click', this.checkCloseMenu);
        } else {
            document.removeEventListener('click', this.checkCloseMenu);
        }
        this.props.onMenuToggled(!this.state.menuVisible);
        this.setState({ menuVisible: !this.state.menuVisible, submenusVisible: [] });
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
            this.props.openExternalUrl(item.url, item.target, "appmenu.items." + item.key);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.mapClickAction || (item.identifyEnabled ? "identify" : null));
        }
    }
    renderMenuItems = (items, level) => {
        if (items) {
            return items.map(item => {
                if (item.themeWhitelist && !item.themeWhitelist.includes(this.props.currentTheme.title)) {
                    return null;
                }
                if (item.subitems) {
                    return (
                        <li className={this.state.submenusVisible[level] === item.key ? "expanded" : ""}
                            key={item.key}
                            onClick={() => this.onSubmenuClicked(item.key, level)}
                        >
                            <Icon icon={item.icon} size="xlarge"/>
                            <Message msgId={"appmenu.items." + item.key} />
                            {item.title}
                            <ul>
                                {this.renderMenuItems(item.subitems, level + 1)}
                            </ul>
                        </li>
                    );
                } else {
                    return (
                        <li className="appmenu-leaf" key={item.key + (item.mode || "")} onClick={() => this.onMenuitemClicked(item)} >
                            <Icon icon={item.icon} size="xlarge"/>
                            <span className="appmenu-leaf-label">
                                <Message msgId={"appmenu.items." + item.key} />
                                {item.comment ? (<div className="appmenu-leaf-comment">
                                    <Message msgId={"appmenu.items." + item.key + (item.mode || "") + "_comment"} />
                                </div>) : null}
                            </span>
                        </li>
                    );
                }
            });
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
        return (
            <div className={"AppMenu " + className}
                onTouchEnd={ev => ev.stopPropagation()}
                onTouchMove={ev => ev.stopPropagation()} onTouchStart={ev => ev.stopPropagation()}  ref={el => { this.menuEl = el; }}
            >
                <div className="appmenu-button-container" onMouseDown={this.toggleMenu}>
                    {this.props.buttonContents}
                </div>
                <Swipeable onSwipedUp={this.toggleMenu} preventDefaultTouchmoveEvent>
                    <div className="appmenu-menu-container">
                        <ul className="appmenu-menu">
                            {this.renderMenuItems(this.props.menuItems, 0)}
                        </ul>
                    </div>
                </Swipeable>
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

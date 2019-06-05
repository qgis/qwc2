/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {Swipeable} = require('react-swipeable');
const Message = require('../components/I18N/Message');
const {setCurrentTask, openExternalUrl} = require('../actions/task');
const Icon = require('./Icon');
require('./style/AppMenu.css');


class AppMenu extends React.Component {
    static propTypes = {
        buttonContents: PropTypes.object,
        menuItems: PropTypes.array,
        appMenuClearsTask: PropTypes.bool,
        currentTaskBlocked: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        openExternalUrl: PropTypes.func,
        currentTheme: PropTypes.object
    }
    static defaultProps = {
        buttonContents: null,
        appMenuClearsTask: false
    }
    state = {
        menuVisible: false,
        submenusVisible: []
    }
    constructor(props) {
        super(props);
        this.menuEl = null;
    }
    toggleMenu = () => {
        if(!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        if(!this.state.menuVisible) {
            document.addEventListener('click', this.checkCloseMenu);
        } else {
            document.removeEventListener('click', this.checkCloseMenu);
        }
        this.setState({ menuVisible: !this.state.menuVisible, submenusVisible: [] });
    }
    checkCloseMenu = (ev) => {
        if(this.menuEl && !this.menuEl.contains(ev.target)) {
            this.toggleMenu();
        }
    }
    onSubmenuClicked = (key, level) => {
        let a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState({ submenusVisible: this.state.submenusVisible.slice(0, level).concat(a) });
    }
    onMenuitemClicked = (item) => {
        this.toggleMenu();
        if(item.url) {
            this.props.openExternalUrl(item.url);
        } else {
            this.props.setCurrentTask(item.task || item.key, item.mode, item.identifyEnabled);
        }
    }
    renderMenuItems = (items, level) => {
        if(items) {
            return items.map(item => {
                if(item.themeWhitelist && !item.themeWhitelist.includes(this.props.currentTheme.title)) {
                    return null;
                }
                if(item.subitems) {
                    return (
                        <li key={item.key}
                            className={this.state.submenusVisible[level] === item.key ? "expanded" : ""}
                            onClick={ev => this.onSubmenuClicked(item.key, level)}
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
                        <li key={item.key + (item.mode || "")} onClick={ev => this.onMenuitemClicked(item)} >
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
        return(
            <div id="AppMenu" className={this.props.currentTaskBlocked ? "appmenu-blocked" : this.state.menuVisible ? "appmenu-visible" : ""}
                ref={el => this.menuEl = el} onClick={ev => {}}
                onTouchStart={ev => ev.stopPropagation()} onTouchMove={ev => ev.stopPropagation()}  onTouchEnd={ev => ev.stopPropagation()}
                >
                <div className="appmenu-button-container" onMouseDown={this.toggleMenu}>
                    {this.props.buttonContents}
                </div>
                <Swipeable onSwipedUp={this.toggleMenu} preventDefaultTouchmoveEvent={true}>
                    <ul className="appmenu-menu">
                        {this.renderMenuItems(this.props.menuItems, 0)}
                    </ul>
                </Swipeable>
            </div>
        );
    }
};

module.exports = connect((state) => ({
    currentTaskBlocked: state.task && state.task.blocked || false,
    currentTheme: state.theme.current || {}
}), {
    setCurrentTask: setCurrentTask,
    openExternalUrl: openExternalUrl
})(AppMenu);

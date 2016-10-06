/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {toggleAppMenu, toggleAppSubmenu, triggerAppMenuitem} = require('../actions/AppMenu');
require('./style/AppMenu.css');


const AppMenu = React.createClass({
    propTypes: {
        menuItems: React.PropTypes.array,
        menuVisible: React.PropTypes.bool,
        submenusVisible: React.PropTypes.array,
        menuClicked: React.PropTypes.func,
        submenuClicked: React.PropTypes.func,
        menuitemClicked: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            menuVisible: false,
            submenusVisible: []
        };
    },
    onMenuClicked(ev) {
        this.props.menuClicked(!this.props.menuVisible);
    },
    onSubmenuClicked(ev, key, level) {
        ev.stopPropagation();
        var a = this.props.submenusVisible[level] === key ? [] : [key];
        this.props.submenuClicked(this.props.submenusVisible.slice(0, level).concat(a));
    },
    onMenuitemClicked(ev, key) {
        ev.stopPropagation();
        this.props.menuitemClicked(key);
        this.props.menuClicked(!this.props.menuVisible);
    },
    render() {
        return(
            <div id="AppMenu" className={this.props.menuVisible ? "appmenu-visible" : ""} onClick={this.onMenuClicked}>
                <span className="appmenu-label"><Message msgId="appmenu.menulabel" /></span>
                <Glyphicon className="appmenu-icon" glyph="menu-hamburger"/>
                <ul className="appmenu-menu">
                    {this.renderMenuItems(this.props.menuItems, 0)}
                </ul>
            </div>
        );
    },
    renderMenuItems(items, level) {
        if(items) {
            return items.map(item => {
                if(item.subitems) {
                    return (
                        <li key={item.key} className={this.props.submenusVisible[level] === item.key ? "expanded" : ""} onClick={(ev)=>{this.onSubmenuClicked(ev, item.key, level)}}>
                            <img src={item.icon} />
                            <Message msgId={"appmenu.items." + item.key} />
                            {item.title}
                            <ul>
                            {this.renderMenuItems(item.subitems, level + 1)}
                            </ul>
                        </li>
                    );
                } else {
                    return (
                        <li key={item.key} onClick={(ev)=>{this.onMenuitemClicked(ev, item.key);}}>
                            <img src={item.icon} />
                            <Message msgId={"appmenu.items." + item.key} />
                        </li>
                    );
                }
            });
        } else {
            return null;
        }
    }
});

const selector = (state) => ({
    menuVisible: state.appmenu && state.appmenu.visible,
    submenusVisible: state.appmenu ? state.appmenu.submenus : []
});

module.exports = {
    AppMenu: connect(selector, {
        menuClicked: toggleAppMenu,
        submenuClicked: toggleAppSubmenu,
        menuitemClicked: triggerAppMenuitem
    })(AppMenu)
};

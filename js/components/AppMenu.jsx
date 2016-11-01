/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Swipeable = require('react-swipeable');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {triggerAppMenuitem} = require('../actions/appmenu');
require('./style/AppMenu.css');


const AppMenu = React.createClass({
    propTypes: {
        buttonContents: React.PropTypes.object,
        menuItems: React.PropTypes.array,
        menuitemClicked: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            buttonContents: null
        };
    },
    getInitialState() {
        return { menuVisible: false, submenusVisible: [] };
    },
    onMenuClicked() {
        this.setState({ menuVisible: !this.state.menuVisible });
    },
    hideMenu() {
        this.setState({ menuVisible: false });
    },
    onSubmenuClicked(ev, key, level) {
        ev.stopPropagation();
        var a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState({ submenusVisible: this.state.submenusVisible.slice(0, level).concat(a) });
    },
    onMenuitemClicked(ev, key) {
        ev.stopPropagation();
        this.props.menuitemClicked(key);
        this.hideMenu();
    },
    render() {
        return(
            <div tabIndex="1" id="AppMenu" className={this.state.menuVisible ? "appmenu-visible" : ""} onClick={this.onMenuClicked} onBlur={this.hideMenu}>
                {this.props.buttonContents}
                <Swipeable onSwipedUp={this.hideMenu}>
                    <ul className="appmenu-menu">
                        {this.renderMenuItems(this.props.menuItems, 0)}
                    </ul>
                </Swipeable>
            </div>
        );
    },
    renderMenuItems(items, level) {
        if(items) {
            return items.map(item => {
                if(item.subitems) {
                    return (
                        <li key={item.key} className={this.state.submenusVisible[level] === item.key ? "expanded" : ""} onClick={(ev)=>{this.onSubmenuClicked(ev, item.key, level)}}>
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

module.exports = {
    AppMenu: connect(() => { return {}; }, {
        menuitemClicked: triggerAppMenuitem
    })(AppMenu)
};

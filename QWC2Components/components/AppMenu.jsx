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
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {setCurrentTask} = require("../actions/task");
const {triggerTool} = require('../actions/maptools');
require('./style/AppMenu.css');


const AppMenu = React.createClass({
    propTypes: {
        buttonContents: React.PropTypes.object,
        menuItems: React.PropTypes.array,
        menuitemClicked: React.PropTypes.func,
        appMenuClearsTask: React.PropTypes.bool,
        setCurrentTask: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            buttonContents: null,
            appMenuClearsTask: false
        };
    },
    getInitialState() {
        return { menuVisible: false, submenusVisible: [] };
    },
    onMenuClicked() {
        if(!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        this.setState({ menuVisible: !this.state.menuVisible, submenusVisible: [] });
    },
    hideMenu() {
        this.setState({ menuVisible: false, submenusVisible: [] });
    },
    onSubmenuClicked(ev, key, level) {
        this.killEvent(ev);
        var a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState({ submenusVisible: this.state.submenusVisible.slice(0, level).concat(a) });
    },
    onMenuitemClicked(ev, key, mode) {
        this.refs.appmenu.blur();
        this.props.menuitemClicked(key, mode);
    },
    killEvent(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    render() {
        return(
            <div tabIndex="1" id="AppMenu" className={this.state.menuVisible ? "appmenu-visible" : ""} onMouseDown={this.onMenuClicked} onClick={this.killEvent} onBlur={()=> {this.hideMenu();}} ref="appmenu">
                <div className="appmenu-button-container">
                    {this.props.buttonContents}
                </div>
                <Swipeable onSwipedUp={this.hideMenu}>
                    <ul className="appmenu-menu">
                        {this.renderMenuItems(this.props.menuItems, 0)}
                    </ul>
                </Swipeable>
            </div>
        );
    },
    renderMenuItems(items, level) {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        if(items) {
            return items.map(item => {
                if(item.subitems) {
                    return (
                        <li key={item.key}
                            className={this.state.submenusVisible[level] === item.key ? "expanded" : ""}
                            onMouseDown={(ev)=>{this.onSubmenuClicked(ev, item.key, level)}}
                            onClick={this.killEvent}
                        >
                            <img src={assetsPath + "/" + item.icon} />
                            <Message msgId={"appmenu.items." + item.key} />
                            {item.title}
                            <ul>
                            {this.renderMenuItems(item.subitems, level + 1)}
                            </ul>
                        </li>
                    );
                } else {
                    return (
                        <li key={item.key + (item.mode || "")}
                            onMouseDown={(ev)=>{this.onMenuitemClicked(ev, item.key, item.mode);}}
                            onClick={this.killEvent}>
                            <img src={assetsPath + "/" + item.icon} />
                            <Message msgId={"appmenu.items." + item.key + (item.mode || "")} />
                        </li>
                    );
                }
            });
        } else {
            return null;
        }
    }
});

module.exports = connect(() => { return {}; }, {
    menuitemClicked: triggerTool,
    setCurrentTask: setCurrentTask
})(AppMenu);

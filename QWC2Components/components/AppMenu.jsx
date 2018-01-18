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
const Swipeable = require('react-swipeable');
const Message = require('../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const {setCurrentTask} = require("../actions/task");
require('./style/AppMenu.css');


class AppMenu extends React.Component {
    static propTypes = {
        buttonContents: PropTypes.object,
        menuItems: PropTypes.array,
        appMenuClearsTask: PropTypes.bool,
        currentTaskBlocked: PropTypes.bool,
        setCurrentTask: PropTypes.func
    }
    static defaultProps = {
        buttonContents: null,
        appMenuClearsTask: false
    }
    state = {
        menuVisible: false,
        submenusVisible: []
    }
    onMenuClicked = () => {
        if(!this.state.menuVisible && this.props.appMenuClearsTask) {
            this.props.setCurrentTask(null);
        }
        this.setState({ menuVisible: !this.state.menuVisible, submenusVisible: [] });
    }
    hideMenu = () => {
        this.setState({ menuVisible: false, submenusVisible: [] });
    }
    onSubmenuClicked = (ev, key, level) => {
        this.killEvent(ev);
        var a = this.state.submenusVisible[level] === key ? [] : [key];
        this.setState({ submenusVisible: this.state.submenusVisible.slice(0, level).concat(a) });
    }
    onMenuitemClicked = (ev, key, mode) => {
        this.refs.appmenu.blur();
        this.props.setCurrentTask(key, mode);
    }
    killEvent = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    }
    renderMenuItems = (items, level) => {
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
    render() {
        return(
            <div tabIndex="1" id="AppMenu" className={this.props.currentTaskBlocked ? "appmenu-blocked" : this.state.menuVisible ? "appmenu-visible" : ""} onMouseDown={this.onMenuClicked} onClick={this.killEvent} onBlur={()=> {this.hideMenu();}} ref="appmenu">
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
    }
};

module.exports = connect((state) => ({
    currentTaskBlocked: state.task && state.task.blocked || false
}), {
    setCurrentTask: setCurrentTask
})(AppMenu);

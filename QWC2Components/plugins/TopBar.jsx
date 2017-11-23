/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const Swipeable = require('react-swipeable');
const Message = require('../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const {qwc2TextSearch} = require("../actions/search");
const {toggleFullscreen} = require('../actions/display');
require('./style/TopBar.css');

class TopBar extends React.Component {
    static propTypes = {
        mobile: PropTypes.bool,
        menuItems: PropTypes.array,
        toolbarItems: PropTypes.array,
        fullscreen: PropTypes.bool,
        toggleFullscreen: PropTypes.func,
        searchProviders: PropTypes.object,
        logoFormat: PropTypes.string,
        searchOptions: PropTypes.object,
        appMenuClearsTask: PropTypes.bool
    }
    static defaultProps = {
        searchOptions: {},
        menuItems: [],
        toolbarItems: [],
        logoFormat: "svg",
        clearTaskOnShow: false
    }
    render() {
        let buttonContents;
        let logo;
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        if(this.props.mobile) {
            buttonContents = (
                <span className="appmenu-button">
                    <Glyphicon className="appmenu-icon" glyph="menu-hamburger"/>
                </span>
            );
            logo = assetsPath + "/img/logo-mobile." + this.props.logoFormat;
        } else {
            buttonContents = (
                <span className="appmenu-button">
                    <span className="appmenu-label"><Message msgId="appmenu.menulabel" /></span>
                    <Glyphicon className="appmenu-icon" glyph="menu-hamburger"/>
                </span>
            );
            logo = assetsPath + "/img/logo."  + this.props.logoFormat;
        }

        let classes = classnames({
            "mobile": this.props.mobile,
            "fullscreen": this.props.fullscreen
        });
        return (
            <Swipeable onSwipedUp={this.triggerFullscreen}>
                <div id="TopBar" className={classes}>
                    <img className="logo" src={logo} />
                    <div className="center-span">
                        <this.props.components.Search searchOptions={this.props.searchOptions}/>
                        <this.props.components.Toolbar toolbarItems={this.props.toolbarItems} />
                    </div>
                    <this.props.components.AppMenu menuItems={this.props.menuItems} buttonContents={buttonContents} appMenuClearsTask={this.props.appMenuClearsTask} />
                    <this.props.components.FullscreenSwitcher />
                </div>
            </Swipeable>
         );
     }
     triggerFullscreen = () => {
         this.props.toggleFullscreen(true);
     }
};

module.exports = (components) => { return {
    TopBarPlugin: connect((state) => ({
        mobile: state.browser ? state.browser.mobile : false,
        fullscreen: state.display && state.display.fullscreen,
        components: components
    }), {
        toggleFullscreen: toggleFullscreen
    })(TopBar),
    reducers: {
        display: require("../reducers/display"),
        search: require('../reducers/search'),
    }
}};

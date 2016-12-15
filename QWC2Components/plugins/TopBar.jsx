/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const classnames = require('classnames');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const Swipeable = require('react-swipeable');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const {AppMenu} = require("../components/AppMenu");
const {FullscreenSwitcher} = require("../components/FullscreenSwitcher");
const {Search} = require("../components/Search");
const {resultsPurge, resetSearch, searchTextChanged} = require("../../MapStore2/web/client/actions/search");
const {qwc2TextSearch} = require("../actions/search");
const {toggleFullscreen} = require('../actions/display');
require('./style/TopBar.css');

const TopBar = React.createClass({
    propTypes: {
        mobile: React.PropTypes.bool,
        menuItems: React.PropTypes.array,
        fullscreen: React.PropTypes.bool,
        toggleFullscreen: React.PropTypes.func,
        searchProviders: React.PropTypes.object,
        search: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            search: {}
        };
    },
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
            logo = assetsPath + "/img/logo-mobile.svg";
        } else {
            buttonContents = (
                <span className="appmenu-button">
                    <span className="appmenu-label"><Message msgId="appmenu.menulabel" /></span>
                    <Glyphicon className="appmenu-icon" glyph="menu-hamburger"/>
                </span>
            );
            logo = assetsPath + "/img/logo.svg";
        }

        let classes = classnames({
            "mobile": this.props.mobile,
            "fullscreen": this.props.fullscreen
        });
        return (
            <Swipeable onSwipedUp={this.triggerFullscreen}>
                <div id="TopBar" className={classes}>
                    <img className="logo" src={logo} />
                    <Search searchProviders={this.props.searchProviders} minScale={this.props.search.minScale} />
                    <AppMenu menuItems={this.props.menuItems} buttonContents={buttonContents} />
                    <FullscreenSwitcher />
                </div>
            </Swipeable>
         );
     },
     triggerFullscreen() {
         this.props.toggleFullscreen(true);
     }
});

module.exports = (searchProviders) => { return {
    TopBarPlugin: connect((state) => ({
        mobile: state.browser ? state.browser.mobile : false,
        fullscreen: state.display && state.display.fullscreen,
        searchProviders: searchProviders
    }), {
        toggleFullscreen: toggleFullscreen
    })(TopBar),
    reducers: {
        display: require("../reducers/display"),
        search: require('../../MapStore2/web/client/reducers/search'),
    }
}};

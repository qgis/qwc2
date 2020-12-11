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
const assign = require('object-assign');
const {connect} = require('react-redux');
const {Swipeable} = require('react-swipeable');
const Icon = require('../components/Icon');
const Message = require('../components/I18N/Message');
const ConfigUtils = require("../utils/ConfigUtils");
const {toggleFullscreen} = require('../actions/display');
const {openExternalUrl} = require('../actions/task');
const {setTopbarHeight} = require('../actions/map');
const {restoreDefaultTheme} = require('../actions/theme');
require('./style/TopBar.css');


class TopBar extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        appMenuVisibleOnStartup: PropTypes.bool,
        components: PropTypes.object,
        fullscreen: PropTypes.bool,
        logoFormat: PropTypes.string,
        logoSrc: PropTypes.string,
        logoUrl: PropTypes.string,
        menuItems: PropTypes.array,
        mobile: PropTypes.bool,
        openExternalUrl: PropTypes.func,
        restoreDefaultTheme: PropTypes.func,
        searchOptions: PropTypes.object,
        setTopbarHeight: PropTypes.func,
        toggleFullscreen: PropTypes.func,
        toolbarItems: PropTypes.array
    }
    static defaultProps = {
        searchOptions: {},
        menuItems: [],
        toolbarItems: [],
        logoFormat: "svg"
    }
    render() {
        let buttonContents;
        let logo;
        const assetsPath = ConfigUtils.getConfigProp("assetsPath");
        if (this.props.mobile) {
            buttonContents = (
                <span className="appmenu-button">
                    <Icon className="appmenu-icon" icon="menu-hamburger"/>
                </span>
            );
            logo = assetsPath + "/img/logo-mobile." + this.props.logoFormat;
        } else {
            buttonContents = (
                <span className="appmenu-button">
                    <span className="appmenu-label"><Message msgId="appmenu.menulabel" /></span>
                    <Icon className="appmenu-icon" icon="menu-hamburger"/>
                </span>
            );
            logo = assetsPath + "/img/logo."  + this.props.logoFormat;
        }

        const classes = classnames({
            mobile: this.props.mobile,
            fullscreen: this.props.fullscreen
        });
        let logoEl = (<img className="logo" src={this.props.logoSrc || logo} />);
        if (this.props.logoUrl) {
            logoEl = (<a href={this.props.logoUrl} rel="noreferrer" target="_blank">{logoEl}</a>);
        }
        // Convert legacy minScale option to minScaleDenom
        const searchOptions = assign({}, this.props.searchOptions);
        searchOptions.minScaleDenom = searchOptions.minScaleDenom || searchOptions.minScale;
        delete searchOptions.minScale;
        return (
            <Swipeable
                onSwipedDown={() => this.props.toggleFullscreen(false)}
                onSwipedUp={() => this.props.toggleFullscreen(true)}
                preventDefaultTouchmoveEvent>
                <div className={classes} id="TopBar" ref={this.storeHeight}>
                    {logoEl}
                    <div className="center-span">
                        <this.props.components.Search searchOptions={searchOptions}/>
                        <this.props.components.Toolbar toolbarItems={this.props.toolbarItems} />
                    </div>
                    <this.props.components.AppMenu
                        appMenuClearsTask={this.props.appMenuClearsTask} buttonContents={buttonContents}
                        menuItems={this.props.menuItems}
                        openExternalUrl={this.props.openExternalUrl}
                        showOnStartup={this.props.appMenuVisibleOnStartup} />
                    <this.props.components.FullscreenSwitcher />
                </div>
            </Swipeable>
        );
    }
    triggerFullscreen = () => {
        this.props.toggleFullscreen(true);
    }
    storeHeight = (el) => {
        if (el) {
            this.props.setTopbarHeight(el.clientHeight);
        }
    }
}

module.exports = (components) => {
    return {
        TopBarPlugin: connect((state) => ({
            mobile: state.browser ? state.browser.mobile : false,
            fullscreen: state.display && state.display.fullscreen,
            components: components
        }), {
            toggleFullscreen: toggleFullscreen,
            restoreDefaultTheme: restoreDefaultTheme,
            openExternalUrl: openExternalUrl,
            setTopbarHeight: setTopbarHeight
        })(TopBar),
        reducers: {
            display: require("../reducers/display"),
            search: require("../reducers/search")
        }
    };
};

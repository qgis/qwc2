/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {connect} from 'react-redux';
import {toggleFullscreen} from '../actions/display';
import {openExternalUrl} from '../actions/task';
import {setTopbarHeight} from '../actions/map';
import {restoreDefaultTheme} from '../actions/theme';
import {showIframeDialog} from '../actions/windows';
import Icon from '../components/Icon';
import {Swipeable} from '../components/Swipeable';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/TopBar.css';


/**
 * Top bar, containing the logo, searchbar, task buttons and app menu.
 */
class TopBar extends React.Component {
    static propTypes = {
        /** Whether opening the app menu clears the active task. */
        appMenuClearsTask: PropTypes.bool,
        /** Whether to display the filter field in the app menu. */
        appMenuFilterField: PropTypes.bool,
        /** The shortcut for tiggering the app menu, i.e. alt+shift+m. */
        appMenuShortcut: PropTypes.string,
        /** Whether to open the app menu on application startup. */
        appMenuVisibleOnStartup: PropTypes.bool,
        components: PropTypes.object,
        fullscreen: PropTypes.bool,
        /** The logo file format. */
        logoFormat: PropTypes.string,
        /** The logo image URL if a different source than the default assets/img/logo.<ext> and assets/img/logo-mobile.<ext> is desired. */
        logoSrc: PropTypes.string,
        /** The hyperlink to open when the logo is clicked. */
        logoUrl: PropTypes.string,
        /** The menu items. Refer to the corresponding chapter of the viewer documentation and the sample config.json. */
        menuItems: PropTypes.array,
        mobile: PropTypes.bool,
        openExternalUrl: PropTypes.func,
        restoreDefaultTheme: PropTypes.func,
        /** Options passed down to the search component. */
        searchOptions: PropTypes.object,
        setTopbarHeight: PropTypes.func,
        showIframeDialog: PropTypes.func,
        toggleFullscreen: PropTypes.func,
        /** The toolbar. Refer to the corresponding chapter of the viewer documentation and the sample config.json. */
        toolbarItems: PropTypes.array,
        /** The keyboard shortcut prefix for triggering toolbar tasks. I.e. alt+shift. The task are then triggered by <prefix>+{1,2,3,...} for the 1st, 2nd, 3rd... toolbar icon. */
        toolbarItemsShortcutPrefix: PropTypes.string
    };
    static defaultProps = {
        searchOptions: {},
        menuItems: [],
        toolbarItems: [],
        logoFormat: "svg"
    };
    render() {
        let buttonContents;
        let logo;
        const assetsPath = ConfigUtils.getAssetsPath();
        const tooltip = LocaleUtils.tr("appmenu.menulabel");
        if (this.props.mobile) {
            buttonContents = (
                <span className="appmenu-button">
                    <Icon className="appmenu-icon" icon="menu-hamburger" title={tooltip}/>
                </span>
            );
            logo = assetsPath + "/img/logo-mobile." + this.props.logoFormat;
        } else {
            buttonContents = (
                <span className="appmenu-button">
                    <span className="appmenu-label">{LocaleUtils.tr("appmenu.menulabel")}</span>
                    <Icon className="appmenu-icon" icon="menu-hamburger" title={tooltip}/>
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
        const searchOptions = {...this.props.searchOptions};
        searchOptions.minScaleDenom = searchOptions.minScaleDenom || searchOptions.minScale;
        delete searchOptions.minScale;
        return (
            <Swipeable
                onSwipedDown={() => this.props.toggleFullscreen(false)}
                onSwipedUp={() => this.props.toggleFullscreen(true)}>
                <div className={classes} id="TopBar" ref={this.storeHeight}>
                    {logoEl}
                    <div className="center-span">
                        {this.props.components.Search ? (
                            <this.props.components.Search searchOptions={searchOptions}/>
                        ) : null}
                        {this.props.components.Toolbar ? (
                            <this.props.components.Toolbar
                                openExternalUrl={this.openUrl}
                                toolbarItems={this.props.toolbarItems}
                                toolbarItemsShortcutPrefix={this.props.toolbarItemsShortcutPrefix} />
                        ) : null}
                    </div>
                    {this.props.components.AppMenu ? (
                        <this.props.components.AppMenu
                            appMenuClearsTask={this.props.appMenuClearsTask}
                            appMenuShortcut={this.props.appMenuShortcut}
                            buttonContents={buttonContents}
                            menuItems={this.props.menuItems}
                            openExternalUrl={this.openUrl}
                            showFilterField={this.props.appMenuFilterField}
                            showOnStartup={this.props.appMenuVisibleOnStartup} />
                    ) : null}
                    {this.props.components.FullscreenSwitcher ? (
                        <this.props.components.FullscreenSwitcher />
                    ) : null}
                </div>
            </Swipeable>
        );
    }
    openUrl = (url, target, title) => {
        if (target === "iframe") {
            this.props.showIframeDialog("externallinkiframe", url, {title: title});
        } else {
            this.props.openExternalUrl(url);
        }
    };
    storeHeight = (el) => {
        if (el) {
            this.props.setTopbarHeight(el.clientHeight);
        }
    };
}

export default (components) => {
    return connect((state) => ({
        mobile: state.browser.mobile,
        fullscreen: state.display.fullscreen,
        components: components
    }), {
        toggleFullscreen: toggleFullscreen,
        restoreDefaultTheme: restoreDefaultTheme,
        openExternalUrl: openExternalUrl,
        setTopbarHeight: setTopbarHeight,
        showIframeDialog: showIframeDialog
    })(TopBar);
};

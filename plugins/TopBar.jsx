/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classnames from 'classnames';
import PropTypes from 'prop-types';

import {toggleFullscreen} from '../actions/display';
import {setTopbarHeight} from '../actions/map';
import {openExternalUrl} from '../actions/task';
import {restoreDefaultTheme} from '../actions/theme';
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
        /** Whether show an appMenu compact (menu visible on icons hover) - Only available for desktop client. */
        appMenuCompact: PropTypes.bool,
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
        searchOptions: PropTypes.shape({
            /** Whether to show the search filter widget (SearchBox only). */
            allowSearchFilters: PropTypes.bool,
            /** Whether to hide the result labels on the map. */
            hideResultLabels: PropTypes.bool,
            /** The style used for highlighting search result geometries. */
            highlightStyle: PropTypes.shape({
                /* Stroke color rgba array, i.e. [255, 0, 0, 0.5] */
                strokeColor: PropTypes.array,
                /* Stroke width */
                strokeWidth: PropTypes.number,
                /* Stroke dash/gap pattern array. Empty for solid line. */
                strokeDash: PropTypes.array,
                /* Fill color rgba array, i.e. [255, 0, 0, 0.33] */
                fillColor: PropTypes.array
            }),
            /** Minimum scale denominator when zooming to search result. */
            minScaleDenom: PropTypes.number,
            /** Maximum number of results the fulltext search should return (SearchBox only). */
            resultLimit: PropTypes.number,
            /** Whether to collapse search sections by default (SearchBox only). */
            sectionsDefaultCollapsed: PropTypes.bool,
            /** Whether to show the layer tree after selectinga theme result. */
            showLayerAfterChangeTheme: PropTypes.bool,
            /** Whether to show provider selection menu (Search only). */
            showProviderSelection: PropTypes.bool,
            /** Whether to list the names of active providers as search field placeholder (Search only). */
            showProvidersInPlaceholder: PropTypes.bool,
            /** Whether to show the 'All providers' entry in the provider selection menu (Search only). */
            providerSelectionAllowAll: PropTypes.bool,
            /** Whether to zoom to layer search results. */
            zoomToLayers: PropTypes.bool
        }),
        setTopbarHeight: PropTypes.func,
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
        if (this.props.mobile || this.props.appMenuCompact) {
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
        // Menu compact only available for desktop client
        const menuCompact = !this.props.mobile ? this.props.appMenuCompact : false;
        // Keep menu open when appMenu is in compact mode (Visible on Hover)
        const keepMenuOpen = menuCompact;
        // Menu should be visible on startup when appMenu is in compact mode (Visible on Hover)
        const showOnStartup = this.props.appMenuVisibleOnStartup || menuCompact;
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
                            keepMenuOpen={keepMenuOpen}
                            menuCompact={menuCompact}
                            menuItems={this.props.menuItems}
                            openExternalUrl={this.openUrl}
                            showFilterField={this.props.appMenuFilterField}
                            showOnStartup={showOnStartup} />
                    ) : null}
                    {this.props.components.FullscreenSwitcher ? (
                        <this.props.components.FullscreenSwitcher />
                    ) : null}
                </div>
            </Swipeable>
        );
    }
    openUrl = (url, target, title, icon) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title, icon});
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
        setTopbarHeight: setTopbarHeight
    })(TopBar);
};

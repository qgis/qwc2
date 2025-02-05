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
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {toggleFullscreen} from '../actions/display';
import {openExternalUrl, setTopbarHeight} from '../actions/windows';
import {Swipeable} from '../components/Swipeable';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';

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
        /** Whether to hide the app menu (useful primarely as a theme specific setting). */
        appMenuHidden: PropTypes.bool,
        /** The shortcut for tiggering the app menu, i.e. alt+shift+m. */
        appMenuShortcut: PropTypes.string,
        /** Whether to open the app menu on application startup. */
        appMenuVisibleOnStartup: PropTypes.bool,
        components: PropTypes.object,
        currentTheme: PropTypes.object,
        fullscreen: PropTypes.bool,
        /** The logo file format. */
        logoFormat: PropTypes.string,
        /** The logo image URL if a different source than the default assets/img/logo.<ext> and assets/img/logo-mobile.<ext> is desired. */
        logoSrc: PropTypes.string,
        /** The hyperlink to open when the logo is clicked. */
        logoUrl: PropTypes.string,
        mapMargins: PropTypes.object,
        /** The menu items. Refer to the corresponding chapter of the viewer documentation and the sample config.json. */
        menuItems: PropTypes.array,
        openExternalUrl: PropTypes.func,
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
            /** Result count limit which is passed to the search provider. */
            resultLimit: PropTypes.number,
            /** Whether to collapse search sections by default (SearchBox only). */
            sectionsDefaultCollapsed: PropTypes.bool,
            /** Whether to show the layer tree after selecting a theme result. */
            showLayerAfterChangeTheme: PropTypes.bool,
            /** Whether to show layer results before pkaces in the result menu (SearchBox only). */
            showLayerResultsBeforePlaces: PropTypes.bool,
            /** Whether to show provider selection menu (Search only). */
            showProviderSelection: PropTypes.bool,
            /** Whether to list the names of active providers as search field placeholder (Search only). */
            showProvidersInPlaceholder: PropTypes.bool,
            /** Whether to replace the search text with the selected search result text (SearchBox only). */
            showResultInSearchText: PropTypes.bool,
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
        searchOptions: {
            showResultInSearchText: true
        },
        menuItems: [],
        toolbarItems: [],
        logoFormat: "svg"
    };
    state = {
        allowedMenuItems: [],
        allowedToolbarItems: []
    };
    componentDidMount() {
        this.setState({
            allowedToolbarItems: this.allowedItems(this.props.toolbarItems),
            allowedMenuItems: this.allowedItems(this.props.menuItems)
        });
    }
    componentDidUpdate(prevProps) {
        if (this.props.currentTheme !== prevProps.currentTheme) {
            this.setState({
                allowedToolbarItems: this.allowedItems(this.props.toolbarItems),
                allowedMenuItems: this.allowedItems(this.props.menuItems)
            });
        }
    }
    render() {
        let logo;
        const assetsPath = ConfigUtils.getAssetsPath();
        const isMobile = ConfigUtils.isMobile();
        if (isMobile || this.props.appMenuCompact) {
            logo = assetsPath + "/img/logo-mobile." + this.props.logoFormat;
        } else {
            logo = assetsPath + "/img/logo."  + this.props.logoFormat;
        }

        const classes = classnames({
            TopBar: true,
            mobile: isMobile,
            fullscreen: this.props.fullscreen
        });
        let logoEl = (<img className="topbar-logo" src={this.props.logoSrc || logo} />);
        if (this.props.logoUrl) {
            logoEl = (<a href={this.props.logoUrl} rel="noreferrer" target="_blank">{logoEl}</a>);
        }
        // Convert legacy minScale option to minScaleDenom
        const searchOptions = {...this.props.searchOptions};
        searchOptions.minScaleDenom = searchOptions.minScaleDenom || searchOptions.minScale;
        delete searchOptions.minScale;
        // Menu compact only available for desktop client
        const menuCompact = !isMobile ? this.props.appMenuCompact : false;
        // Keep menu open when appMenu is in compact mode (Visible on Hover)
        const keepMenuOpen = menuCompact;
        // Menu should be visible on startup when appMenu is in compact mode (Visible on Hover)
        const showOnStartup = this.props.appMenuVisibleOnStartup || menuCompact;
        const style = this.props.mapMargins.splitTopAndBottomBar ? {
            marginLeft: this.props.mapMargins.left + 'px',
            marginRight: this.props.mapMargins.right + 'px'
        } : {};
        return (
            <Swipeable
                onSwipedDown={() => this.props.toggleFullscreen(false)}
                onSwipedUp={() => this.props.toggleFullscreen(true)}
            >
                <div className={classes} ref={this.storeHeight} style={style}>
                    {logoEl}
                    <div className="topbar-center-span">
                        {this.props.components.Search ? (
                            <div className="topbar-search-container">
                                <this.props.components.Search searchOptions={searchOptions}/>
                            </div>
                        ) : null}
                        {this.props.components.Toolbar ? (
                            <this.props.components.Toolbar
                                openExternalUrl={this.openUrl}
                                toolbarItems={this.state.allowedToolbarItems}
                                toolbarItemsShortcutPrefix={this.props.toolbarItemsShortcutPrefix} />
                        ) : null}
                    </div>
                    {this.props.components.AppMenu && !this.props.appMenuHidden ? (
                        <this.props.components.AppMenu
                            appMenuClearsTask={this.props.appMenuClearsTask}
                            appMenuShortcut={this.props.appMenuShortcut}
                            buttonLabel={LocaleUtils.tr("appmenu.menulabel")}
                            keepMenuOpen={keepMenuOpen}
                            menuCompact={menuCompact}
                            menuItems={this.state.allowedMenuItems}
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
    allowedItems = (items) => {
        return items.map(item => {
            if (item.subitems) {
                const subitems = this.allowedItems(item.subitems);
                if (!isEmpty(subitems)) {
                    return {...item, subitems};
                } else {
                    return null;
                }
            } else {
                if (!ThemeUtils.themeFlagsAllowed(this.props.currentTheme, item.themeFlagWhitelist, item. themeFlagBlacklist)) {
                    return null;
                }
                if (item.themeBlacklist && (item.themeBlacklist.includes(this.props.currentTheme.title) || item.themeBlacklist.includes(this.props.currentTheme.name))) {
                    return null;
                }
                if (item.themeWhitelist && !(item.themeWhitelist.includes(this.props.currentTheme.title) || item.themeWhitelist.includes(this.props.currentTheme.name))) {
                    return null;
                }
                if (item.requireAuth && !ConfigUtils.getConfigProp("username")) {
                    return null;
                }
                return item;
            }
        }).filter(Boolean);
    };
}

export default (components) => {
    return connect((state) => ({
        fullscreen: state.display.fullscreen,
        components: components,
        currentTheme: state.theme.current,
        mapMargins: state.windows.mapMargins
    }), {
        toggleFullscreen: toggleFullscreen,
        openExternalUrl: openExternalUrl,
        setTopbarHeight: setTopbarHeight
    })(TopBar);
};

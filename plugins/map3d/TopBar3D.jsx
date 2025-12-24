/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {toggleFullscreen, ViewMode} from '../../actions/display';
import {openExternalUrl, setTopbarHeight} from '../../actions/windows';
import AppMenu from '../../components/AppMenu';
import FullscreenSwitcher from '../../components/FullscreenSwitcher';
import SearchField3D from '../../components/map3d/SearchField3D';
import {Swipeable} from '../../components/Swipeable';
import Toolbar from '../../components/Toolbar';
import ConfigUtils from '../../utils/ConfigUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import ThemeUtils from '../../utils/ThemeUtils';


/**
 * Bottom bar of the 3D map, including the search bar, tool bar and menu.
 */
class TopBar3D extends React.Component {
    static propTypes = {
        currentTheme: PropTypes.object,
        fullscreen: PropTypes.bool,
        /** The menu items, in the same format as the 2D `TopBar` menu items.
         * You can include entries for the View3D plugins.
         * You can also include entries for 2D plugins which are compatible with the 3D view (i.e. `ThemeSwitcher`, `Share`, etc.),
         * these will be displayed only in fullsceen 3D mode. */
        menuItems: PropTypes.array,
        openExternalUrl: PropTypes.func,
        sceneContext: PropTypes.object,
        /** Options passed down to the search component. */
        searchOptions: PropTypes.shape({
            /** Minimum scale denominator when zooming to search result. */
            minScaleDenom: PropTypes.number
        }),
        setTopbarHeight: PropTypes.func,
        toggleFullscreen: PropTypes.func,
        /** The toolbar, in the same format as the 2D `TopBar` toolbar items.
         * You can include entries for the View3D plugins.
         * You can also include entries for 2D plugins which are compatible with the 3D view (i.e. `ThemeSwitcher`, `Share`, etc.),
         * these will be displayed only in fullsceen 3D mode. */
        toolbarItems: PropTypes.array,
        viewMode: PropTypes.number
    };
    static defaultProps = {
        searchOptions: {
            minScaleDenom: 1000
        }
    };
    state = {
        allowedMenuItems: [],
        allowedToolbarItems: []
    };
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.props.currentTheme !== prevProps.currentTheme || this.props.viewMode !== prevProps.viewMode) {
            this.setState({
                allowedToolbarItems: ThemeUtils.allowedItems(this.props.toolbarItems, this.props.currentTheme, this.filter2DItems),
                allowedMenuItems: ThemeUtils.allowedItems(this.props.menuItems, this.props.currentTheme, this.filter2DItems)
            });
        }
    }
    filter2DItems = (item) => {
        const pluginConf = ConfigUtils.getPluginConfig(item.key);
        return isEmpty(pluginConf) || (this.props.viewMode === ViewMode._3DFullscreen && pluginConf.availableIn3D);
    };
    render() {
        const config = ConfigUtils.getPluginConfig("TopBar")?.cfg || {};
        let logo;
        const assetsPath = ConfigUtils.getAssetsPath();
        const isMobile = ConfigUtils.isMobile();
        if (isMobile) {
            logo = assetsPath + "/img/logo-mobile." + (config.logoFormat || "svg");
        } else {
            logo = assetsPath + "/img/logo."  + (config.logoFormat || "svg");
        }
        let logoEl = (<img className="topbar-logo" src={config.logoSrc || logo} />);
        if (config.logoUrl) {
            logoEl = (<a href={config.logoUrl} rel="noreferrer" target="_blank">{logoEl}</a>);
        }
        const menuCompact = !isMobile ? config.appMenuCompact : false;

        const classes = classNames({
            TopBar: true,
            mobile: isMobile,
            fullscreen: this.props.fullscreen
        });

        return (
            <Swipeable
                onSwipedDown={() => this.props.toggleFullscreen(false)}
                onSwipedUp={() => this.props.toggleFullscreen(true)}
            >
                <div className={classes} ref={this.storeHeight}>
                    {logoEl}
                    <div className="topbar-center-span">
                        <div className="topbar-search-container">
                            <SearchField3D sceneContext={this.props.sceneContext} searchOptions={this.props.searchOptions} />
                        </div>
                        <Toolbar
                            openExternalUrl={this.openUrl}
                            toolbarItems={this.state.allowedToolbarItems} />
                    </div>
                    <AppMenu
                        appMenuClearsTask={config.appMenuClearsTask}
                        appMenuShortcut={config.appMenuShortcut}
                        buttonLabel={LocaleUtils.tr("appmenu.menulabel")}
                        keepMenuOpen={menuCompact}
                        menuCompact={menuCompact}
                        menuItems={this.state.allowedMenuItems}
                        openExternalUrl={this.openUrl}
                        showFilterField={config.appMenuFilterField} />
                    {this.props.viewMode === ViewMode._3DFullscreen ? (
                        <FullscreenSwitcher />
                    ) : null}
                </div>
            </Swipeable>
        );
    }
    storeHeight = (el) => {
        if (el) {
            this.props.setTopbarHeight(el.clientHeight);
        }
    };
    openUrl = (url, target, title, icon) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title, icon});
    };
    addGenericMenuItems = (menuItems, inputConfig) => {
        inputConfig.forEach(entry => {
            if (entry.subitems) {
                const group = [];
                this.addGenericMenuItems(group, entry.subitems);
                if (group.length > 0) {
                    menuItems.push({...entry, subitems: group});
                }
            } else {
                const pluginConfig = ConfigUtils.getPluginConfig(entry.key);
                if (entry.url || pluginConfig.availableIn3D) {
                    menuItems.push(entry);
                }
            }
        });
    };
}

export default connect((state) => ({
    currentTheme: state.theme.current,
    fullscreen: state.display.fullscreen,
    viewMode: state.display.viewMode
}), {
    setTopbarHeight: setTopbarHeight,
    toggleFullscreen: toggleFullscreen,
    openExternalUrl: openExternalUrl
})(TopBar3D);

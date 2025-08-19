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
import PropTypes from 'prop-types';

import {toggleFullscreen, View3DMode} from '../../actions/display';
import {openExternalUrl, setTopbarHeight} from '../../actions/windows';
import AppMenu from '../../components/AppMenu';
import FullscreenSwitcher from '../../components/FullscreenSwitcher';
import {Swipeable} from '../../components/Swipeable';
import Toolbar from '../../components/Toolbar';
import SearchField3D from '../../components/map3d/SearchField3D';
import ConfigUtils from '../../utils/ConfigUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import ThemeUtils from '../../utils/ThemeUtils';


class TopBar3D extends React.Component {
    static availableIn3D = true;

    static propTypes = {
        currentTheme: PropTypes.object,
        fullscreen: PropTypes.bool,
        menuItems: PropTypes.array,
        openExternalUrl: PropTypes.func,
        sceneContext: PropTypes.object,
        setTopbarHeight: PropTypes.func,
        toggleFullscreen: PropTypes.func,
        toolbarItems: PropTypes.array,
        view3dMode: PropTypes.number
    };
    state = {
        allowedMenuItems: [],
        allowedToolbarItems: []
    };
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.props.currentTheme !== prevProps.currentTheme || this.props.view3dMode !== prevProps.view3dMode) {
            this.setState({
                allowedToolbarItems: ThemeUtils.allowedItems(this.props.toolbarItems, this.props.currentTheme, this.filter2DItems),
                allowedMenuItems: ThemeUtils.allowedItems(this.props.menuItems ?? this.defaultMenuItems(), this.props.currentTheme, this.filter2DItems)
            });
        }
    }
    defaultMenuItems = () => {
        return [
            {key: "LayerTree3D", icon: "layers", builtIn: true},
            {key: "Draw3D", icon: "draw", builtIn: true},
            {key: "Measure3D", icon: "measure", builtIn: true},
            {key: "Compare3D", icon: "compare", builtIn: true},
            {key: "HideObjects3D", icon: "eye", builtIn: true},
            {key: "MapLight3D", icon: "light", builtIn: true},
            {key: "MapExport3D", icon: "rasterexport", builtIn: true},
            {key: "ExportObjects3D", icon: "export", builtIn: true},
            {key: "Settings3D", icon: "cog", builtIn: true}
        ].concat(ConfigUtils.getPluginConfig("TopBar")?.cfg?.menuItems ?? []);
    };
    filter2DItems = (item) => {
        const pluginConf = ConfigUtils.getPluginConfig(item.key);
        const isFullScreen = this.props.view3dMode === View3DMode.FULLSCREEN;
        return item.builtIn || (!pluginConf.name && isFullScreen) || (pluginConf.availableIn3D && (!pluginConf.availableIn2D || isFullScreen));
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
                            <SearchField3D sceneContext={this.props.sceneContext} />
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
                    {this.props.view3dMode === View3DMode.FULLSCREEN ? (
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
    view3dMode: state.display.view3dMode
}), {
    setTopbarHeight: setTopbarHeight,
    toggleFullscreen: toggleFullscreen,
    openExternalUrl: openExternalUrl
})(TopBar3D);

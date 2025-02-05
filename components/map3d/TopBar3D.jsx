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

import {toggleFullscreen} from '../../actions/display';
import {openExternalUrl, setTopbarHeight} from '../../actions/windows';
import ConfigUtils from '../../utils/ConfigUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import AppMenu from '../AppMenu';
import FullscreenSwitcher from '../FullscreenSwitcher';
import {Swipeable} from '../Swipeable';
import SearchField3D from './SearchField3D';


class TopBar3D extends React.Component {
    static propTypes = {
        fullscreen: PropTypes.bool,
        openExternalUrl: PropTypes.func,
        options: PropTypes.object,
        sceneContext: PropTypes.object,
        searchProviders: PropTypes.object,
        setTopbarHeight: PropTypes.func,
        toggleFullscreen: PropTypes.func
    };
    state = {
    };
    render() {
        const config = ConfigUtils.getPluginConfig("TopBar").cfg;
        const menuItems = [
            {key: "LayerTree3D", icon: "layers"},
            {key: "Draw3D", icon: "draw"},
            {key: "Measure3D", icon: "measure"},
            {key: "Compare3D", icon: "compare"},
            {key: "DateTime3D", icon: "clock"},
            {key: "MapExport3D", icon: "rasterexport"}
        ];
        this.addGenericMenuItems(menuItems, config.menuItems);

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
                        <SearchField3D options={this.props.options} sceneContext={this.props.sceneContext} searchProviders={this.props.searchProviders} />
                    </div>
                    <AppMenu
                        appMenuClearsTask={config.appMenuClearsTask}
                        appMenuShortcut={config.appMenuShortcut}
                        buttonLabel={LocaleUtils.tr("appmenu.menulabel")}
                        keepMenuOpen={menuCompact}
                        menuCompact={menuCompact}
                        menuItems={menuItems}
                        openExternalUrl={this.openUrl}
                        showFilterField={config.appMenuFilterField} />
                    <FullscreenSwitcher />
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
                if (pluginConfig.availableIn3D) {
                    menuItems.push(entry);
                }
            }
        });
    };
}

export default connect((state) => ({
    fullscreen: state.display.fullscreen
}), {
    setTopbarHeight: setTopbarHeight,
    toggleFullscreen: toggleFullscreen,
    openExternalUrl: openExternalUrl
})(TopBar3D);

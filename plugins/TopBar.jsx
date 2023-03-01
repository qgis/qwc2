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


class TopBar extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        appMenuFilterField: PropTypes.bool,
        appMenuShortcut: PropTypes.string,
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
        showIframeDialog: PropTypes.func,
        toggleFullscreen: PropTypes.func,
        toolbarItems: PropTypes.array,
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

/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask, openExternalUrl} from '../actions/task';
import AppMenu from '../components/AppMenu';
import Icon from '../components/Icon';
import ThemeList from '../components/ThemeList';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';

import './style/Portal.css';


/**
 * Displays a landing lage, consisting of a full-screen theme switcher and a configurable menu.
 */
class Portal extends React.Component {
    static propTypes = {
        /** Links to show in the portal bottom bar */
        bottomBarLinks: PropTypes.arrayOf(PropTypes.shape({
            href: PropTypes.string,
            label: PropTypes.string,
            labelmsgid: PropTypes.string,
            target: PropTypes.string
        })),
        currentTask: PropTypes.string,
        currentTheme: PropTypes.object,
        keepMenuOpen: PropTypes.bool,
        /** Name of a logo image below assets/img. */
        logo: PropTypes.string,
        map: PropTypes.object,
        /** Portal menu items, in the same format as the TopBar menu items. */
        menuItems: PropTypes.array,
        openExternalUrl: PropTypes.func,
        setCurrentTask: PropTypes.func,
        /** Whether the menu should be visible on startup. */
        showMenuOnStartup: PropTypes.bool,
        themes: PropTypes.object,
        /** Portal title text to show in the top bar. */
        topBarText: PropTypes.string,
        userName: PropTypes.string
    };
    static defaultProps = {
        menuItems: []
    };
    state = {
        filter: "",
        popupClosed: false,
        menuVisible: false
    };
    componentDidMount() {
        if (!UrlParams.getParam('t') && !UrlParams.getParam('k') && !UrlParams.getParam('bk')) {
            this.props.setCurrentTask("Portal");
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.currentTask === "Portal" && (
            this.props.currentTask !== prevProps.currentTask ||
            this.props.currentTheme !== prevProps.currentTheme ||
            this.props.map !== prevProps.map
        )) {
            UrlParams.clear();
        } else if (!prevProps.themes && this.props.themes && this.props.currentTask !== "Portal") {
            // Show portal if no theme is to be loaded
            const theme = ThemeUtils.getThemeById(this.props.themes, UrlParams.getParam('t'));
            if ((!theme || theme.restricted) && (ConfigUtils.getConfigProp("dontLoadDefaultTheme") || !this.props.themes.defaultTheme)) {
                this.props.setCurrentTask("Portal");
            }
        }
    }
    render() {
        if (this.props.currentTask !== "Portal") {
            return null;
        }
        const assetsPath = ConfigUtils.getAssetsPath();
        const preserveSettings = ConfigUtils.getConfigProp("preserveSettingsOnPortalThemeSwitch");
        return (
            <div className="Portal">
                <div className="portal-topbar">
                    <img className="portal-logo" src={assetsPath + "/img/" + this.props.logo} />
                    <span className="portal-topbar-text" dangerouslySetInnerHTML={{__html: this.props.topBarText}} />
                    <input
                        className="portal-search-field"
                        onChange={ev => this.setState({filter: ev.target.value})}
                        placeholder={LocaleUtils.tr("portal.filter")}
                        type="text"
                        value={this.state.filter} />
                    <span className="portal-topbar-spacer" />
                    <AppMenu appMenuClearsTask={false} buttonContents={this.menuButtonContents()}
                        keepMenuOpen={this.props.keepMenuOpen} menuItems={this.props.menuItems} onMenuToggled={this.menuToggled}
                        openExternalUrl={this.openUrl}
                        showOnStartup={this.props.showMenuOnStartup} />
                </div>
                <div className={"portal-body " + (this.state.menuVisible ? "portal-body-menuvisible" : "")}>
                    <ThemeList collapsibleGroups dontPreserveSettingsOnSwitch={!preserveSettings} filter={this.state.filter} />
                </div>
                <div className="portal-bottombar">
                    {this.props.userName ? (
                        <div className="portal-bottombar-user">
                            <Icon icon="logout" /><span>{this.props.userName}</span>
                        </div>
                    ) : null}
                    <div className="portal-bottombar-links">
                        {(this.props.bottomBarLinks || []).map((link, idx) => {
                            const label = link.labelmsgid ? LocaleUtils.tr(link.labelmsgid) : link.label;
                            return (
                                <a href="#" key={"l" + idx} onClick={() => this.openUrl(link.href, link.target, {title: label})}>{label}</a>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
    menuButtonContents = () => {
        return (
            <span className="portal-menu-button">
                <span className="portal-menu-label">{LocaleUtils.tr("portal.menulabel")}</span>
                <Icon className="portal-menu-icon" icon="menu-hamburger"/>
            </span>
        );
    };
    openUrl = (url, target, title) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title, zIndex: 250});
    };
    menuToggled = (visible) => {
        this.setState({menuVisible: visible});
    };
}

const selector = (state) => ({
    currentTask: state.task.id,
    currentTheme: state.theme.current,
    map: state.map,
    themes: state.theme.themes,
    userName: state.localConfig.username || ""
});

export default connect(selector, {
    setCurrentTask: setCurrentTask,
    openExternalUrl: openExternalUrl
})(Portal);

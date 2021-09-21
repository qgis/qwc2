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
import {Swipeable} from 'react-swipeable';
import {toggleFullscreen} from '../actions/display';
import {openExternalUrl} from '../actions/task';
import {setTopbarHeight} from '../actions/map';
import {restoreDefaultTheme} from '../actions/theme';
import Icon from '../components/Icon';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/TopBar.css';


class TopBar extends React.Component {
    static propTypes = {
        appMenuClearsTask: PropTypes.bool,
        appMenuFilterField: PropTypes.bool,
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
                onSwipedUp={() => this.props.toggleFullscreen(true)}
                preventDefaultTouchmoveEvent>
                <div className={classes} id="TopBar" ref={this.storeHeight}>
                    {logoEl}
                    <div className="center-span">
                        <this.props.components.Search searchOptions={searchOptions}/>
                        <this.props.components.Toolbar toolbarItems={this.props.toolbarItems} />
                    </div>
                    <this.props.components.AppMenu
                        appMenuClearsTask={this.props.appMenuClearsTask}
                        buttonContents={buttonContents}
                        menuItems={this.props.menuItems}
                        openExternalUrl={this.props.openExternalUrl}
                        showFilterField={this.props.appMenuFilterField}
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

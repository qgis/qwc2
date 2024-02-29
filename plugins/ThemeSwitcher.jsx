/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import SideBar from '../components/SideBar';
import ThemeLayersListWindow from '../components/ThemeLayersListWindow';
import ThemeList from '../components/ThemeList';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/ThemeSwitcher.css';


/**
 * Theme switcher panel.
 */
class ThemeSwitcher extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        /** Whether to allow collapsing theme groups. */
        collapsibleGroups: PropTypes.bool,
        currentTask: PropTypes.object,
        /** Whether to show an icon to select the default theme/bookmark (of a logged in user). */
        showDefaultThemeSelector: PropTypes.bool,
        /** Whether to show the LayerTree by default after switching the theme. */
        showLayerAfterChangeTheme: PropTypes.bool,
        /** Wether to show the theme filter field in the top bar. **/
        showThemeFilter: PropTypes.bool,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        /** The default window size for the theme layers dialog. */
        themeLayersListWindowSize: PropTypes.shape({
            width: PropTypes.number,
            height: PropTypes.number
        }),
        /** Default width as a CSS string. */
        width: PropTypes.string
    };
    static defaultProps = {
        width: "50%",
        showThemeFilter: true,
        showDefaultThemeSelector: true,
        showLayerAfterChangeTheme: false,
        themeLayersListWindowSize: {width: 400, height: 300},
        side: 'right'
    };
    state = {
        filter: ""
    };
    render() {
        const allowAddingOtherThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.activeTheme) ===  true;
        const themeFilter = this.props.showThemeFilter ? (
            <InputContainer className="theme-switcher-filter">
                <input onChange={ev => this.setState({filter: ev.target.value})}
                    placeholder={LocaleUtils.tr("themeswitcher.filter")}
                    ref={this.focusFilterField} role="input"
                    type="text" value={this.state.filter}/>
                <Icon icon="remove" onClick={() => this.setState({filter: ""})} role="suffix" />
            </InputContainer>
        ) : null;
        const extraTitlebarContent = (themeFilter);
        return (
            <div>
                <SideBar extraTitlebarContent={extraTitlebarContent} icon="themes" id="ThemeSwitcher" minWidth="16em" side={this.props.side}
                    title="appmenu.items.ThemeSwitcher" width={this.props.width}>
                    {() => ({
                        body: (
                            <ThemeList
                                activeTheme={this.props.activeTheme}
                                allowAddingOtherThemes={allowAddingOtherThemes}
                                collapsibleGroups={this.props.collapsibleGroups}
                                filter={this.state.filter}
                                showDefaultThemeSelector={this.props.showDefaultThemeSelector}
                                showLayerAfterChangeTheme={this.props.showLayerAfterChangeTheme}/>
                        )
                    })}
                </SideBar>
                <ThemeLayersListWindow windowSize={this.props.themeLayersListWindowSize} />
            </div>
        );
    }
    focusFilterField = (el) => {
        if (el) {
            // Need to wait until slide in transition is over
            setTimeout(() => {
                if (this.props.currentTask && this.props.currentTask.id === "ThemeSwitcher") {
                    el.focus();
                }
            }, 500);
        }
    };
}

const selector = (state) => ({
    activeTheme: state.theme.current
});

export default connect(selector, {})(ThemeSwitcher);

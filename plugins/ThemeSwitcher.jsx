/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Icon from '../components/Icon';
import InputContainer from '../components/InputContainer';
import SideBar from '../components/SideBar';
import ThemeList from '../components/ThemeList';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeLayersListWindow from '../components/ThemeLayersListWindow';
import './style/ThemeSwitcher.css';

class ThemeSwitcher extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        collapsibleGroups: PropTypes.bool,
        currentTask: PropTypes.object,
        showLayerAfterChangeTheme: PropTypes.bool,
        side: PropTypes.string,
        themeLayersListWindowSize: PropTypes.object,
        width: PropTypes.string
    };
    static defaultProps = {
        width: "50%",
        showLayerAfterChangeTheme: false,
        themeLayersListWindowSize: {width: 400, height: 300},
        side: 'right'
    };
    state = {
        filter: ""
    };
    render() {
        const allowAddingOtherThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.activeTheme) ===  true;
        const extraTitlebarContent = (
            <InputContainer className="theme-switcher-filter">
                <input onChange={ev => this.setState({filter: ev.target.value})}
                    placeholder={LocaleUtils.tr("themeswitcher.filter")}
                    ref={this.focusFilterField} role="input"
                    type="text" value={this.state.filter}/>
                <Icon icon="remove" onClick={() => this.setState({filter: ""})} role="suffix" />
            </InputContainer>
        );
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
                                showLayerAfterChangeTheme={this.props.showLayerAfterChangeTheme} />
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

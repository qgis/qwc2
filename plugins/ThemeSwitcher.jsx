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
import SideBar from '../components/SideBar';
import ThemeList from '../components/ThemeList';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeLayersListWindow from '../components/ThemeLayersListWindow';
import './style/ThemeSwitcher.css';

class ThemeSwitcher extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        bboxDependentLegend: PropTypes.bool,
        collapsibleGroups: PropTypes.bool,
        currentTask: PropTypes.object,
        showLayerAfterChangeTheme: PropTypes.bool,
        themeLayersListWindowSize: PropTypes.object,
        width: PropTypes.string
    }
    static defaultProps = {
        width: "50%",
        showLayerAfterChangeTheme: false,
        themeLayersListWindowSize: {width: 400, height: 300}
    }
    state = {
        filter: ""
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        const allowAddingOtherThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.activeTheme) ===  true;
        const extraTitlebarContent = (
            <input className="theme-switcher-filter" onChange={ev => this.setState({filter: ev.target.value})}
                placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")} ref={this.focusFilterField}
                type="text"
                value={this.state.filter}/>
        );
        return (
            <div>
                <SideBar extraTitlebarContent={extraTitlebarContent} icon="themes" id="ThemeSwitcher" minWidth="16em"
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
                <ThemeLayersListWindow bboxDependentLegend={this.props.bboxDependentLegend} windowSize={this.props.themeLayersListWindowSize} />
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
    }
}

const selector = (state) => ({
    activeTheme: state.theme.current
});

export default connect(selector, {})(ThemeSwitcher);

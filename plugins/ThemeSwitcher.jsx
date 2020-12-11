/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {SideBar} = require('../components/SideBar');
const ThemeList = require('../components/ThemeList');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const ThemeLayersListWindow = require('../components/ThemeLayersListWindow');
require('./style/ThemeSwitcher.css');

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
    activeTheme: state.theme ? state.theme.current : null
});

module.exports = {
    ThemeSwitcherPlugin: connect(selector, {})(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../reducers/layers')
    }
};

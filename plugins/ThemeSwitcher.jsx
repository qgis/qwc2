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
const removeDiacritics = require('diacritics').remove;
const {SideBar} = require('../components/SideBar');
const ThemeList = require('../components/ThemeList');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
require('./style/ThemeSwitcher.css');

class ThemeSwitcher extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        width: PropTypes.string,
        showLayerAfterChangeTheme: PropTypes.bool,
        collapsibleGroups: PropTypes.bool
    }
    static defaultProps = {
        width: "50%",
        showLayerAfterChangeTheme: false
    }
    state = {
        filter: "",
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        let allowAddingOtherThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.activeTheme) ===  true;
        let extraTitlebarContent = (
            <input className="theme-switcher-filter" type="text"
                value={this.state.filter} ref={this.focusFilterField}
                onChange={ev => this.setState({filter: ev.target.value})}
                placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
        );
        let filter = this.state.filter ? new RegExp(removeDiacritics(this.state.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i") : null;
        return (
            <SideBar id="ThemeSwitcher" minWidth="16em" width={this.props.width} title="appmenu.items.ThemeSwitcher"
                icon="themes" extraTitlebarContent={extraTitlebarContent}>
                {() => ({
                    body: (
                        <ThemeList
                            showLayerAfterChangeTheme={this.props.showLayerAfterChangeTheme}
                            collapsibleGroups={this.props.collapsibleGroups}
                            allowAddingOtherThemes={allowAddingOtherThemes}
                            activeTheme={this.props.activeTheme}
                            filter={this.state.filter} />
                    )
                })}
            </SideBar>
        );
    }
    focusFilterField = (el) => {
        if(el) {
            // Need to wait until slide in transition is over
            setTimeout(() => {
                if (this.props.currentTask && this.props.currentTask.id === "ThemeSwitcher") {
                    el.focus();
                }
            }, 500);
        }
    }
};

const selector = (state) => ({
    activeTheme: state.theme ? state.theme.current : null
});

module.exports = {
    ThemeSwitcherPlugin: connect(selector, {})(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../reducers/layers'),
    }
};

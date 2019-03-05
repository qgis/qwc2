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
const Message = require('../components/I18N/Message');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const {LayerRole, addLayer} = require("../actions/layers");
const {setCurrentTheme} = require("../actions/theme");
const {setCurrentTask} = require("../actions/task");
const Icon = require('../components/Icon');
const {SideBar} = require('../components/SideBar');
const ThemeUtils = require('../utils/ThemeUtils');
require('./style/ThemeSwitcher.css');

class ThemeSwitcher extends React.Component {
    static propTypes = {
        themes: PropTypes.object,
        activeTheme: PropTypes.object,
        layers: PropTypes.array,
        changeTheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        mapConfig: PropTypes.object,
        width: PropTypes.string,
        addLayer: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        width: "50%"
    }
    state = {
        filter: ""
    }
    groupMatchesFilter = (group, filter) => {
        if(group && group.items) {
            for(let i = 0, n = group.items.length; i < n; ++i) {
                if(removeDiacritics(group.items[i].title).match(filter) ||
                   removeDiacritics(group.items[i].keywords).match(filter)) {
                    return true;
                }
            }
        }
        if(group && group.subdirs) {
            for(let i = 0, n = group.subdirs.length; i < n; ++i) {
                if(this.groupMatchesFilter(group.subdirs[i], filter)) {
                    return true;
                }
            }
        }
        return false;
    }
    renderThemeGroup = (group) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let filter = new RegExp(removeDiacritics(this.state.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
        let subdirs = (group && group.subdirs ? group.subdirs : []);
        if(filter !== "") {
            subdirs = subdirs.filter(subdir => this.groupMatchesFilter(subdir, filter));
        }
        let subtree = subdirs.map(subdir =>
            (<li key={subdir.title} className="theme-group"><span>{subdir.title}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
        );
        let activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        let addTitle = LocaleUtils.getMessageById(this.context.messages, "themeswitcher.addtotheme");
        return (<ul>
            {(group && group.items ? group.items : []).map(item => {
                return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords).match(filter) ? (
                    <li key={item.id}
                        className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"}
                        onClick={ev => this.setTheme(item)}
                        title={item.keywords}
                    >
                        <div className="theme-item-title" title={item.title}>{item.title}</div>
                        <img src={assetsPath + "/" + item.thumbnail} />
                        {ConfigUtils.getConfigProp("allowAddingOtherThemes") ===  true ? (<Icon icon="plus" title={addTitle} onClick={ev => this.addThemeLayers(ev, item)} />) : null}
                    </li>) : null;
            })}
            {subtree}
            </ul>);
    }
    render() {
        let extraTitlebarContent = (
            <input className="themeswitcher-filter" type="text"
                value={this.state.filter} ref={this.focusFilterField}
                onChange={ev => this.setState({filter: ev.target.value})}
                placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
        );
        return (
            <SideBar id="ThemeSwitcher" minWidth="16em" width={this.props.width} title="appmenu.items.ThemeSwitcher"
                icon="themes" extraTitlebarContent={extraTitlebarContent}>
                {() => ({
                    body: this.renderThemeGroup(this.props.themes)
                })}
            </SideBar>
        );
    }
    setTheme = (theme) => {
        this.props.setCurrentTask(null);
        this.props.changeTheme(theme, this.props.themes);
    }
    addThemeLayers = (ev, theme) => {
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(theme, null, LayerRole.USERLAYER));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
    focusFilterField = (el) => {
        if(el) {
            // Need to wait until slide in transition is over
            setTimeout(() => {
                if (this.props.currentTask.id == "ThemeSwitcher") {
                    el.focus();
                } 
            }, 500);
        }
    }
};

const selector = (state) => ({
    themes: state.theme && state.theme.themes || {},
    activeTheme: state.theme ? state.theme.current : null,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapConfig: state.map ? state.map : undefined,
    currentTask: state.task
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        setCurrentTask: setCurrentTask,
        addLayer: addLayer
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../reducers/layers'),
    }
};

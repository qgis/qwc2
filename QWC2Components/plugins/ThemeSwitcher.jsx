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
const Message = require('../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2Components/utils/LocaleUtils");
const {setCurrentTheme} = require("../actions/theme");
const {setCurrentTask} = require("../actions/task");
const {SideBar} = require('../components/SideBar');
require('./style/ThemeSwitcher.css');
const removeDiacritics = require('diacritics').remove;

class ThemeSwitcher extends React.Component {
    static propTypes = {
        themes: PropTypes.object,
        activeTheme: PropTypes.object,
        layers: PropTypes.array,
        changeTheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        mapConfig: PropTypes.object,
        width: PropTypes.string
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
        return (<ul role="body">
            {(group && group.items ? group.items : []).map(item => {
                return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords).match(filter) ? (
                    <li key={item.id}
                        className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"}
                        onClick={ev => this.setTheme(item)}
                        title={item.keywords}
                    >
                        <div className="theme-item-title" title={item.title}>{item.title}</div>
                        <img src={assetsPath + "/" + item.thumbnail} /><br />
                    </li>) : null;
            })}
            {subtree}
            </ul>);
    }
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let extraTitlebarContent = (
            <input className="themeswitcher-filter" type="text" value={this.state.filter} onChange={ev => this.setState({filter: ev.target.value})} placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
        );
        return (
            <SideBar id="ThemeSwitcher" minWidth="16em" width={this.props.width} title="appmenu.items.ThemeSwitcher"
                icon={assetsPath + "/img/themes.svg"} extraTitlebarContent={extraTitlebarContent}>
                {this.renderThemeGroup(this.props.themes)}
            </SideBar>
        );
    }
    setTheme = (theme) => {
        this.props.setCurrentTask(null);
        this.props.changeTheme(theme, this.props.themes);
    }
};

const selector = (state) => ({
    themes: state.theme && state.theme.themes || {},
    activeTheme: state.theme ? state.theme.current : null,
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapConfig: state.map ? state.map : undefined
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        setCurrentTask: setCurrentTask
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../reducers/layers'),
    }
};

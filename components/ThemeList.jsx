/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const isEqual = require('lodash.isequal');
const isEmpty = require('lodash.isempty');
const removeDiacritics = require('diacritics').remove;
const Icon = require('./Icon');
const Message = require('./I18N/Message');
const ConfigUtils = require("../utils/ConfigUtils");
const LocaleUtils = require("../utils/LocaleUtils");
const ThemeUtils = require('../utils/ThemeUtils');
const {LayerRole, addLayer} = require("../actions/layers");
const {setCurrentTheme} = require("../actions/theme");
const {setCurrentTask} = require("../actions/task");
const {setActiveLayerInfo} = require("../actions/layerinfo");
require('./style/ThemeList.css');

class ThemeList extends React.Component {
    static propTypes = {
        themes: PropTypes.object,
        activeTheme: PropTypes.object,
        layers: PropTypes.array,
        changeTheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        mapConfig: PropTypes.object,
        addLayer: PropTypes.func,
        setActiveLayerInfo: PropTypes.func,
        allowAddingOtherThemes: PropTypes.bool,
        showLayerAfterChangeTheme: PropTypes.bool,
        collapsibleGroups: PropTypes.bool,
        filter: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        showLayerAfterChangeTheme: false
    }
    state = {
        expandedGroup: [],
        visibleThemeInfoMenu: null
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
    renderThemeGroup = (group, filter, level=[]) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let subdirs = (group && group.subdirs ? group.subdirs : []);
        if(filter) {
            subdirs = subdirs.filter(subdir => this.groupMatchesFilter(subdir, filter));
        }
        let subtree = subdirs.map((subdir, idx) => {
            let sublevel = [...level, idx];
            let expanded = !this.props.collapsibleGroups || filter || isEqual(sublevel, this.state.expandedGroup.slice(0, sublevel.length));
            return (
                <li key={subdir.title} className="theme-group-header">
                    <span onClick={ev => this.setState({expandedGroup: expanded ? sublevel.slice(0, -1) : sublevel})}>
                        {this.props.collapsibleGroups ? (<Icon icon={expanded ? "collapse" : "expand"} />) : null} {subdir.title}
                    </span>
                    {expanded ? this.renderThemeGroup(subdir, filter, sublevel) : null}
                </li>
            );
        });
        let activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        let addTitle = LocaleUtils.getMessageById(this.context.messages, "themeswitcher.addtotheme");
        return (
            <ul className="theme-group-body">
                {(group && group.items ? group.items : []).map(item => {
                    let infoLinks = (item.themeInfoLinks || []).map(name => this.props.themes.themeInfoLinks.find(entry => entry.name === name)).filter(entry => entry);
                    let matches = [];
                    if(filter) {
                        let match = null;
                        if(match = removeDiacritics(item.title).match(filter)) {
                            matches.push(["themeswitcher.match.title", this.extractSubstr(match, item.title), item.title]);
                        }
                        if(match = removeDiacritics(item.keywords).match(filter)) {
                            matches.push(["themeswitcher.match.keywords", this.extractSubstr(match, item.keywords), item.keywords]);
                        }
                        if(match = removeDiacritics(item.abstract).match(filter)) {
                            matches.push(["themeswitcher.match.abstract", this.extractSubstr(match, item.abstract), item.abstract]);
                        }
                    }
                    return (!filter || !isEmpty(matches)) ? (
                        <li key={item.id}
                            className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"}
                            onClick={ev => this.setTheme(item)}
                            title={item.keywords}
                        >
                            <div className="theme-item-title" title={item.title}>
                                <span>{item.title}</span>
                                {!isEmpty(infoLinks) ? (<Icon icon="info" onClick={ev => this.toggleThemeInfoMenu(ev, item.id)}/>) : null}
                            </div>
                            {this.state.visibleThemeInfoMenu === item.id ? (
                                <div className="theme-item-info-links" onClick={ev => ev.stopPropagation()}>
                                    {infoLinks.map(link => (
                                        <a key={link.name} href={link.url} target={link.target}>{link.title}</a>
                                    ))}
                                </div>
                            ) : null}
                            <img src={assetsPath + "/" + item.thumbnail} />
                            {this.props.allowAddingOtherThemes ? (<Icon icon="plus" title={addTitle} onClick={ev => this.addThemeLayers(ev, item)} />) : null}
                            {isEmpty(matches) ? null : (
                                <div className="theme-item-filterinfo-overlay">
                                    {matches.map(match => (
                                        <div key={match[0]} title={match[2]}><i><Message msgId={match[0]} />:</i><br />{match[1][0]}<b>{match[1][1]}</b>{match[1][2]}</div>
                                    ))}
                                </div>
                            )}
                        </li>) : null;
                })}
                {subtree}
            </ul>
        );
    }
    render() {
        let filter = this.props.filter ? new RegExp(removeDiacritics(this.props.filter).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i") : null;
        return (
            <div className="ThemeList">
                {this.renderThemeGroup(this.props.themes, filter)}
            </div>
        );
    }
    extractSubstr = (match, text) => {
        let cleanText = removeDiacritics(text);
        let cleanFilter = removeDiacritics(this.props.filter);
        let padding = Math.round((20 - cleanFilter.length)/2);
        // Add unused right padding to left
        padding += -Math.min(cleanText.length - (match.index + cleanFilter.length) - padding, 0);
        let leftStart = Math.max(match.index - padding, 0);
        let leftLen = Math.min(match.index, padding);
        return [
            (leftStart > 0 ? "\u2026" : "") + cleanText.substr(leftStart, leftLen),
            cleanText.substr(match.index, cleanFilter.length),
            cleanText.substr(match.index + cleanFilter.length)
        ];
    }
    setTheme = (theme) => {
        this.props.setActiveLayerInfo(null, null);
        if(this.props.showLayerAfterChangeTheme) {
            this.props.setCurrentTask('LayerTree');
        }
        else {
            this.props.setCurrentTask(null);
        }
        this.props.changeTheme(theme, this.props.themes);
    }
    toggleThemeInfoMenu = (ev, themeId) => {
        ev.stopPropagation();
        this.setState({visibleThemeInfoMenu: this.state.visibleThemeInfoMenu === themeId ? null : themeId});
    }
    addThemeLayers = (ev, theme) => {
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(theme, this.props.themes, LayerRole.USERLAYER));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
};

const selector = (state) => ({
    themes: state.theme && state.theme.themes || {},
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    mapConfig: state.map ? state.map : undefined
});


module.exports = connect(selector, {
    changeTheme: setCurrentTheme,
    setCurrentTask: setCurrentTask,
    addLayer: addLayer,
    setActiveLayerInfo: setActiveLayerInfo
})(ThemeList);

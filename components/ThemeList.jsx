/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import {remove as removeDiacritics} from 'diacritics';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setActiveLayerInfo} from '../actions/layerinfo';
import {LayerRole, addLayer} from '../actions/layers';
import {setUserInfoFields} from '../actions/localConfig';
import {setCurrentTask} from '../actions/task';
import {setCurrentTheme, setThemeLayersList} from '../actions/theme';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';
import Icon from './Icon';

import './style/ThemeList.css';

class ThemeList extends React.Component {
    static propTypes = {
        activeTheme: PropTypes.object,
        addLayer: PropTypes.func,
        allowAddingOtherThemes: PropTypes.bool,
        changeTheme: PropTypes.func,
        collapsibleGroups: PropTypes.bool,
        defaultUrlParams: PropTypes.string,
        dontPreserveSettingsOnSwitch: PropTypes.bool,
        filter: PropTypes.string,
        layers: PropTypes.array,
        mapConfig: PropTypes.object,
        setActiveLayerInfo: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setThemeLayersList: PropTypes.func,
        setUserInfoFields: PropTypes.func,
        showDefaultThemeSelector: PropTypes.bool,
        showLayerAfterChangeTheme: PropTypes.bool,
        themes: PropTypes.object
    };
    state = {
        expandedGroups: [],
        visibleThemeInfoMenu: null
    };
    groupMatchesFilter = (group, filter) => {
        if (group && group.items) {
            for (let i = 0, n = group.items.length; i < n; ++i) {
                if (removeDiacritics(group.items[i].title).match(filter) ||
                    removeDiacritics(group.items[i].keywords || "").match(filter) ||
                    removeDiacritics(group.items[i].abstract || "").match(filter)) {
                    return true;
                }
            }
        }
        if (group && group.subdirs) {
            for (let i = 0, n = group.subdirs.length; i < n; ++i) {
                if (this.groupMatchesFilter(group.subdirs[i], filter)) {
                    return true;
                }
            }
        }
        return false;
    };
    renderThemeGroup = (group, filter) => {
        const assetsPath = ConfigUtils.getAssetsPath();
        let subdirs = (group && group.subdirs ? group.subdirs : []);
        if (filter) {
            subdirs = subdirs.filter(subdir => this.groupMatchesFilter(subdir, filter));
        }
        const subtree = subdirs.map((subdir) => {
            const expanded = !this.props.collapsibleGroups || filter || this.state.expandedGroups.includes(subdir.id) || (this.props.activeTheme && this.groupContainsActiveTheme(subdir));
            if (isEmpty(subdir.items) && isEmpty(subdir.subdirs)) {
                return null;
            }
            return (
                <li className={"theme-group-header " + (expanded ? "theme-group-header-expanded" : "")} key={subdir.id}>
                    <span onClick={() => this.setState((state) => ({expandedGroups: expanded ? state.expandedGroups.filter(id => id !== subdir.id) : [...state.expandedGroups, subdir.id]}))}>
                        {this.props.collapsibleGroups ? (<Icon icon={expanded ? "collapse" : "expand"} />) : null} {subdir.title}
                    </span>
                    {expanded ? this.renderThemeGroup(subdir, filter) : null}
                </li>
            );
        });
        const activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        const addLayersTitle = LocaleUtils.tr("themeswitcher.addlayerstotheme");
        const addTitle = LocaleUtils.tr("themeswitcher.addtotheme");
        const changeDefaultUrlTitle = LocaleUtils.tr("themeswitcher.changedefaulttheme");
        const openTabTitle = LocaleUtils.tr("themeswitcher.openintab");
        const username = ConfigUtils.getConfigProp("username");

        return (
            <ul className="theme-group-body">
                {(!isEmpty(group.items) ? group.items : []).map(item => {
                    const infoLinks = (item.themeInfoLinks && item.themeInfoLinks.entries || []).map(name => this.props.themes.themeInfoLinks.find(entry => entry.name === name)).filter(entry => entry);
                    const matches = [];
                    if (filter) {
                        let match = null;
                        if ((match = removeDiacritics(item.title).match(filter))) {
                            matches.push([LocaleUtils.trmsg("themeswitcher.match.title"), this.extractSubstr(match, item.title), item.title]);
                        }
                        if ((match = removeDiacritics(item.keywords || "").match(filter))) {
                            matches.push([LocaleUtils.trmsg("themeswitcher.match.keywords"), this.extractSubstr(match, item.keywords), item.keywords]);
                        }
                        if ((match = removeDiacritics(item.abstract || "").match(filter))) {
                            matches.push([LocaleUtils.trmsg("themeswitcher.match.abstract"), this.extractSubstr(match, item.abstract), item.abstract]);
                        }
                        if (isEmpty(matches)) {
                            return null;
                        }
                    }
                    let title = item.abstract;
                    if (title && item.keywords) {
                        title += "\n\n";
                    }
                    if (item.keywords) {
                        title += LocaleUtils.tr("themeswitcher.match.keywords") + ": " + item.keywords;
                    }
                    return (
                        <li className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"}
                            key={item.id}
                            onClick={() => this.setTheme(item)}
                            title={title}
                        >
                            <div className="theme-item-title" title={item.title}>
                                <span>{item.title}</span>

                            </div>
                            {!isEmpty(infoLinks) ? (<div className={"theme-item-info-menu " + (this.state.visibleThemeInfoMenu ? "theme-item-info-menu-active" : "")} onClick={ev => this.toggleThemeInfoMenu(ev, item.id)}>
                                <Icon icon="info" />
                                {item.themeInfoLinks.title ? (<span>{item.themeInfoLinks.title}</span>) : LocaleUtils.tr(item.themeInfoLinks.titleMsgId)}
                                <Icon icon="triangle-down" />
                                {this.state.visibleThemeInfoMenu === item.id ? (
                                    <div className="theme-item-info-links" onClick={ev => ev.stopPropagation()}>
                                        {infoLinks.map(link => (
                                            <a href={link.url} key={link.name} target={link.target}>{link.title}</a>
                                        ))}
                                    </div>
                                ) : null}
                            </div>) : null}
                            <div className="theme-item-body">
                                {item.description ? (<div className="theme-item-description" dangerouslySetInnerHTML={{__html: item.description}} />) : null}
                                <img className="theme-item-thumbnail" src={assetsPath + "/" + item.thumbnail} />
                            </div>
                            {!item.restricted ? (
                                <div className="theme-item-icons">
                                    {this.props.allowAddingOtherThemes ? (<Icon icon="layers" onClick={ev => this.getThemeLayersToList(ev, item)} title={addLayersTitle} />) : null}
                                    {this.props.allowAddingOtherThemes ? (<Icon icon="plus" onClick={ev => this.addThemeLayers(ev, item)} title={addTitle} />) : null}
                                    <Icon icon="open_link" onClick={ev => this.openInTab(ev, item.id)} title={openTabTitle} />
                                    {this.props.showDefaultThemeSelector && username  ? (<Icon className={ (this.extractThemeId(this.props.defaultUrlParams) === item.id ? "icon-active" : "")} icon="new" onClick={ev => this.changeDefaultUrlParams(ev, item.id)} title={changeDefaultUrlTitle} />) : null }
                                </div>
                            ) : (
                                <div className="theme-item-restricted-overlay">
                                    <Icon icon="lock" />
                                </div>
                            )}
                            {isEmpty(matches) ? null : (
                                <div className="theme-item-filterinfo-overlay">
                                    {matches.map(match => (
                                        <div key={match[0]} title={match[2]}><i>{LocaleUtils.tr(match[0])}:</i><br />{match[1][0]}<b>{match[1][1]}</b>{match[1][2]}</div>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
                {subtree}
            </ul>
        );
    };
    groupContainsActiveTheme = (group) => {
        for (const item of (group.items || [])) {
            if (item.id === this.props.activeTheme.id) {
                return true;
            }
        }
        for (const subdir of (group.subdirs || [])) {
            if (this.groupContainsActiveTheme(subdir)) {
                return true;
            }
        }
        return false;
    };
    render() {
        const filter = this.props.filter ? new RegExp(removeDiacritics(this.props.filter).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i") : null;
        return (
            <div className="ThemeList">
                {this.renderThemeGroup(this.props.themes, filter)}
            </div>
        );
    }
    extractSubstr = (match, text) => {
        const cleanText = removeDiacritics(text);
        const cleanFilter = removeDiacritics(this.props.filter);
        let padding = Math.round((20 - cleanFilter.length) / 2);
        // Add unused right padding to left
        padding += -Math.min(cleanText.length - (match.index + cleanFilter.length) - padding, 0);
        const leftStart = Math.max(match.index - padding, 0);
        const leftLen = Math.min(match.index, padding);
        return [
            (leftStart > 0 ? "\u2026" : "") + cleanText.substr(leftStart, leftLen),
            cleanText.substr(match.index, cleanFilter.length),
            cleanText.substr(match.index + cleanFilter.length)
        ];
    };
    extractThemeId = (text) => {
        return Object.fromEntries(text.split("&").map(x => x.split("="))).t;
    };
    setTheme = (theme) => {
        if (theme.restricted) {
            // eslint-disable-next-line
            alert(LocaleUtils.tr("themeswitcher.restrictedthemeinfo"));
            return;
        }
        const hasUserLayer = this.props.layers.find(layer => layer.role === LayerRole.USERLAYER);
        const preserveNonThemeLayers = ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch", this.props.activeTheme);
        // eslint-disable-next-line
        if (hasUserLayer && !preserveNonThemeLayers && !confirm(LocaleUtils.tr("themeswitcher.confirmswitch"))) {
            return;
        }
        this.props.setActiveLayerInfo(null, null);
        if (this.props.showLayerAfterChangeTheme) {
            this.props.setCurrentTask('LayerTree');
        } else {
            this.props.setCurrentTask(null);
        }
        this.props.changeTheme(theme, this.props.themes, !this.props.dontPreserveSettingsOnSwitch);
    };
    toggleThemeInfoMenu = (ev, themeId) => {
        ev.stopPropagation();
        this.setState((state) => ({visibleThemeInfoMenu: state.visibleThemeInfoMenu === themeId ? null : themeId}));
    };
    addThemeLayers = (ev, theme) => {
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(theme, this.props.themes, LayerRole.USERLAYER));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    getThemeLayersToList = (ev, theme) => {
        ev.stopPropagation();
        this.props.setThemeLayersList(theme);
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    openInTab = (ev, themeid) => {
        ev.stopPropagation();
        const url = location.href.split("?")[0] + '?t=' + themeid;
        window.open(url, '_blank');
    };
    changeDefaultUrlParams = (ev, themeid) => {
        ev.stopPropagation();
        const params = {
            default_url_params: "t=" + themeid
        };
        const baseurl = location.href.split("?")[0].replace(/\/$/, '');
        axios.get(baseurl + "/setuserinfo", {params}).then(response => {
            if (!response.data.success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("settings.defaultthemefailed", response.data.error));
            } else {
                this.props.setUserInfoFields(response.data.fields);
            }
        }).catch((e) => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("settings.defaultthemefailed", String(e)));
        });
    };
}

const selector = (state) => ({
    themes: state.theme.themes || {},
    layers: state.layers.flat,
    mapConfig: state.map,
    defaultUrlParams: state.localConfig.user_infos?.default_url_params || ""
});

export default connect(selector, {
    changeTheme: setCurrentTheme,
    setCurrentTask: setCurrentTask,
    addLayer: addLayer,
    setActiveLayerInfo: setActiveLayerInfo,
    setThemeLayersList: setThemeLayersList,
    setUserInfoFields: setUserInfoFields
})(ThemeList);

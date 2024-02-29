/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import url from 'url';

import {setColorScheme, setUserInfoFields} from '../actions/localConfig';
import SideBar from '../components/SideBar';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {getUserBookmarks} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';

import './style/Settings.css';


/**
 * Settings panel.
 *
 * Allows configuring language and color scheme.
 */
class Settings extends React.Component {
    static propTypes = {
        colorScheme: PropTypes.string,
        /** List of available color schemes. Value is the css class name, title/titleMsgId the display name. */
        colorSchemes: PropTypes.arrayOf(PropTypes.shape({
            title: PropTypes.string,
            titleMsgId: PropTypes.string,
            value: PropTypes.string
        })),
        defaultUrlParams: PropTypes.string,
        /** List of available languages. Value is the lang code, title/titleMsgId the display name. */
        languages: PropTypes.arrayOf(PropTypes.shape({
            title: PropTypes.string,
            titleMsgId: PropTypes.string,
            value: PropTypes.string
        })),
        setColorScheme: PropTypes.func,
        setUserInfoFields: PropTypes.func,
        /** Whether to show a selector to set the default theme/bookmark (of a logged in user). */
        showDefaultThemeSelector: PropTypes.bool,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        themes: PropTypes.object
    };
    static defaultProps = {
        colorSchemes: [],
        languages: [],
        side: 'right',
        showDefaultThemeSelector: true
    };
    state = {
        bookmarks: {}
    };
    onShow = () => {
        const username = ConfigUtils.getConfigProp("username");
        if (this.props.showDefaultThemeSelector && username) {
            getUserBookmarks(username, (bookmarks) => {
                const bookmarkKeys = bookmarks.reduce((res, entry) => ({...res, [entry.key]: entry.description}), {});
                this.setState({bookmarks: bookmarkKeys});
            });
        }
    };
    render() {
        return (
            <SideBar icon="cog" id="Settings" onShow={this.onShow} side={this.props.side} title="appmenu.items.Settings" width="25em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        return (
            <div className="settings-body">
                <table className="settings-table">
                    <tbody>
                        {this.renderLanguageSelector()}
                        {this.renderColorSchemeSelector()}
                        {this.renderDefaultThemeSelector()}
                    </tbody>
                </table>
            </div>
        );
    };
    renderLanguageSelector = () => {
        if (isEmpty(this.props.languages)) {
            return null;
        }
        const lang = LocaleUtils.lang();
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.language")}&nbsp;</td>
                <td>
                    <select onChange={this.changeLocale} value={lang}>
                        <option key="syslang" value="">{LocaleUtils.tr("settings.systemlang")}</option>
                        {this.props.languages.map(entry => (
                            <option key={entry.value} value={entry.value}>{entry.title ?? LocaleUtils.tr(entry.titleMsgId)}</option>
                        ))}
                    </select>
                </td>
            </tr>
        );
    };
    renderColorSchemeSelector = () => {
        if (isEmpty(this.props.colorSchemes)) {
            return null;
        }
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.colorscheme")}</td>
                <td>
                    <select onChange={this.changeColorScheme} value={this.props.colorScheme}>
                        {this.props.colorSchemes.map(entry => (
                            <option key={entry.value} value={entry.value}>{entry.title ?? LocaleUtils.tr(entry.titleMsgId)}</option>
                        ))}
                    </select>
                </td>
            </tr>
        );
    };
    renderDefaultThemeSelector = () => {
        if (!this.props.showDefaultThemeSelector || !ConfigUtils.getConfigProp("username")) {
            return null;
        }
        const themeNames = ThemeUtils.getThemeNames(this.props.themes);
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.defaulttheme")}</td>
                <td>
                    <select onChange={this.changeDefaultUrlParams} value={this.props.defaultUrlParams}>
                        <option value="">{LocaleUtils.tr("settings.default")}</option>
                        <option disabled>{LocaleUtils.tr("settings.themes")}</option>
                        {Object.entries(themeNames).map(([id, name]) => (
                            <option key={id} value={'t=' + id}>{name}</option>
                        ))}
                        <option disabled>{LocaleUtils.tr("settings.bookmarks")}</option>
                        {Object.entries(this.state.bookmarks).map(([key, name]) => (
                            <option key={key} value={'bk=' + key}>{name}</option>
                        ))}
                    </select>
                </td>
            </tr>
        );
    };
    changeDefaultUrlParams = (ev) => {
        const params = {
            default_url_params: ev.target.value
        };
        const baseurl = location.href.split("?")[0].replace(/\/$/, '');
        axios.get(baseurl + "/setuserinfo", {params}).then(response => {
            if (!response.data.success) {
                /* eslint-disable-next-line */
                alert(LocaleUtils.tr("settings.defaultthemefailed", response.data.error));
                ev.target.value = this.props.defaultUrlParams;
            } else {
                this.props.setUserInfoFields(response.data.fields);
            }
        }).catch((e) => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("settings.defaultthemefailed", String(e)));
            ev.target.value = this.props.defaultUrlParams;
        });
    };
    changeLocale = (ev) => {
        // eslint-disable-next-line
        if (confirm(LocaleUtils.tr("settings.confirmlang"))) {
            const lang = ev.target.value;
            const urlParts = url.parse(location.href, true);
            if (!lang) {
                delete urlParts.query.lang;
            } else {
                urlParts.query = {
                    ...urlParts.query,
                    lang: lang
                };
            }
            delete urlParts.search;
            location = url.format(urlParts);
        }
    };
    changeColorScheme = (ev) => {
        this.props.setColorScheme(ev.target.value, true);
    };
}

export default connect((state) => ({
    colorScheme: state.localConfig.colorScheme,
    defaultUrlParams: state.localConfig.user_infos?.default_url_params || "",
    themes: state.theme.themes
}), {
    setColorScheme: setColorScheme,
    setUserInfoFields: setUserInfoFields
})(Settings);

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
import GroupSelect from "../components/widgets/GroupSelect";
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';

import './style/Settings.css';

/**
 * Settings panel.
 *
 * Allows configuring language and color scheme.
 */
class Settings extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        bookmarks: PropTypes.array,
        colorScheme: PropTypes.string,
        /** List of available color schemes. Value is the css class name, title/titleMsgId the display name. */
        colorSchemes: PropTypes.arrayOf(PropTypes.shape({
            title: PropTypes.string,
            titleMsgId: PropTypes.string,
            value: PropTypes.string
        })),
        defaultUrlParams: PropTypes.string,
        /** List of available languages. Value is the lang code, title/titleMsgId the display name. Falls back to the toplevel `availableLocales` `config.json` setting if not set. */
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
        themes: PropTypes.object,
        visibilityPresets: PropTypes.array
    };
    static defaultProps = {
        colorSchemes: [],
        languages: null,
        side: 'right',
        showDefaultThemeSelector: true
    };
    render() {
        return (
            <SideBar icon="cog" id="Settings" onShow={this.onShow} side={this.props.side} title={LocaleUtils.tr("appmenu.items.Settings")} width="25em">
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
        let languages = this.props.languages;
        if (!languages) {
            languages = Object.entries(ConfigUtils.getConfigProp("availableLocales", null, {})).map(([code, title]) => ({
                title: title, value: code
            }));
        }
        if (isEmpty(languages)) {
            return null;
        }
        const lang = LocaleUtils.lang();
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.language")}&nbsp;</td>
                <td>
                    <select onChange={this.changeLocale} value={lang}>
                        <option key="syslang" value="">{LocaleUtils.tr("settings.systemlang")}</option>
                        {languages.map(entry => (
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
        const bookmarks = (this.props.bookmarks || []);
        const defaultThemeId = this.props.themes?.defaultTheme;
        const visibilityPresets = (this.props.visibilityPresets || []).filter(vp =>
            defaultThemeId !== null &&
            vp.theme_id !== null &&
            String(vp.theme_id) === String(defaultThemeId)
        );
        const options = {
            [LocaleUtils.tr("settings.themes")]: Object.entries(themeNames).map(([id, name]) => ["t=" + id, name]),
            [LocaleUtils.tr("appmenu.items.Bookmark")]: bookmarks.map(bm => ["bk=" + bm.key, bm.description]),
            [LocaleUtils.tr("appmenu.items.VisibilityPresets")]: visibilityPresets.map(vp => ["vp=" + vp.key, vp.description])
        };
        const defaultOption = ["", LocaleUtils.tr("settings.default")];
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.defaulttheme")}</td>
                <td>
                    <GroupSelect
                        defaultOption={defaultOption}
                        onChange={this.changeDefaultUrlParams}
                        options={options}
                        value={this.props.defaultUrlParams}
                    />
                </td>
            </tr>
        );
    };
    changeDefaultUrlParams = (value) => {
        const params = {
            default_url_params: value
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
    bookmarks: state.bookmark?.bookmarks,
    colorScheme: state.localConfig.colorScheme,
    defaultUrlParams: state.localConfig.user_infos?.default_url_params || "",
    themes: state.theme.themes,
    visibilityPresets: state.bookmark?.visibilityPresets
}), {
    setColorScheme: setColorScheme,
    setUserInfoFields: setUserInfoFields
})(Settings);

/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import isEmpty from 'lodash.isempty';
import url from 'url';
import {setColorScheme} from '../actions/localConfig';
import SideBar from '../components/SideBar';
import LocaleUtils from '../utils/LocaleUtils';
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
        /** List of available languages. Value is the lang code, title/titleMsgId the display name. */
        languages: PropTypes.array,
        setColorScheme: PropTypes.func,
        /** Whether snapping is enabled by default when editing. */
        side: PropTypes.string
    };
    static defaultProps = {
        colorSchemes: [],
        languages: [],
        side: 'right'
    };
    render() {
        return (
            <SideBar icon="cog" id="Settings" side={this.props.side} title="appmenu.items.Settings" width="20em">
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
    colorScheme: state.localConfig.colorScheme
}), {
    setColorScheme: setColorScheme
})(Settings);

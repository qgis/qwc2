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
import SideBar from '../components/SideBar';
import LocaleUtils from '../utils/LocaleUtils';
import './style/Settings.css';

class Settings extends React.Component {
    static propTypes = {
        languages: PropTypes.array,
        side: PropTypes.string
    }
    static defaultProps = {
        languages: [],
        side: 'right'
    }
    state = {
    }
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
                    </tbody>
                </table>
            </div>
        );
    }
    renderLanguageSelector = () => {
        if (isEmpty(this.props.languages)) {
            return null;
        }
        const lang = LocaleUtils.lang();
        return (
            <tr>
                <td>{LocaleUtils.tr("settings.language")}&nbsp;</td>
                <td>
                    <select className="combo" onChange={this.changeLocale} value={lang}>
                        <option key="syslang" value="">{LocaleUtils.tr("settings.systemlang")}</option>
                        {this.props.languages.map(entry => (
                            <option key={entry.value} value={entry.value}>{entry.title ?? LocaleUtils.tr(entry.titleMsgId)}</option>
                        ))}
                    </select>
                </td>
            </tr>
        );
    }
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
    }
}

export default connect(() => ({}), {})(Settings);

/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import LocaleUtils from "../utils/LocaleUtils";

import './style/CookiePopup.css';

/**
 * A simple popup to notify that cookies are used.
 */
export default class CookiePopup extends React.Component {
    state = {
        popupClosed: false
    };
    render() {
        if (document.cookie.split(';').some((item) => item.includes('allowcookies=1'))) {
            return null;
        }
        return (
            <div className="CookiePopup">
                <div className="cookie-popup-text">{LocaleUtils.tr("cookiepopup.message")}</div>
                <div className="cookie-popup-buttonbar">
                    <button onClick={this.allowCookies}>{LocaleUtils.tr("cookiepopup.accept")}</button>
                </div>
            </div>
        );
    }
    allowCookies = () => {
        const days = 14;
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = "allowcookies=1; SameSite=Lax; expires=" + d.toUTCString();
        this.setState({popupClosed: true});
    };
}

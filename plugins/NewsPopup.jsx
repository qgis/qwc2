/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import Icon from '../components/Icon';
import LocaleUtils from '../utils/LocaleUtils';

import './style/NewsPopup.css';


/**
 * Displays a newsletter in a popup dialog.
 *
 * The popup won't be dispayed anymore, if the user chooses so, until a newer
 * revision is published (specified via newsRev prop).
 */
export default class NewsPopup extends React.Component {
    static propTypes = {
        /** URL to the news HTML document to display in the popup. */
        newsDocument: PropTypes.string,
        /** Revision of the document. */
        newsRev: PropTypes.string
    };
    state = {
        dontShowAgain: false,
        showPopup: false
    };
    constructor(props) {
        super(props);
        this.state.showPopup = !document.cookie.split(';').some((item) => item.includes('newsrev=' + props.newsRev));
    }
    render() {
        if (!this.state.showPopup || !this.props.newsDocument) {
            return null;
        }
        return (
            <div className="newspopup-dialog-container">
                <div className="newspopup-dialog-popup">
                    <div className="newspopup-dialog-popup-title"><span>{LocaleUtils.tr("newspopup.title")}</span><Icon icon="remove" onClick={this.closeDialog} /></div>
                    <div className="newspopup-dialog-popup-body">
                        <iframe src={this.props.newsDocument} />
                        <div className="newspopup-dialog-popup-buttonbar">
                            <button onClick={this.closeDialog}>{LocaleUtils.tr("newspopup.dialogclose")}</button>
                            <label><input onChange={ev => this.setState({dontShowAgain: ev.target.checked})} type="checkbox" value={this.state.dontShowAgain} /> {LocaleUtils.tr("newspopup.dontshowagain")}</label>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    closeDialog = () => {
        if (this.state.dontShowAgain) {
            const days = 14;
            const d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = "newsrev=" + this.props.newsRev + "; SameSite=Lax; expires=" + d.toUTCString();
        }
        this.setState({showPopup: false});
    };
}

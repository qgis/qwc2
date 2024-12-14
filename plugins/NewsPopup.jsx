/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import LocaleUtils from '../utils/LocaleUtils';

import './style/NewsPopup.css';


/**
 * Displays a newsletter in a popup dialog.
 *
 * The popup won't be dispayed anymore, if the user chooses so, until a newer
 * revision is published (specified via newsRev prop).
 */
class NewsPopup extends React.Component {
    static propTypes = {
        /** URL to the news HTML document to display in the popup. */
        newsDocument: PropTypes.string,
        /** Revision of the document. */
        newsRev: PropTypes.string,
        setCurrentTask: PropTypes.func,
        /** Whether to show the news in a sidebar instead of a popup. */
        showInSidebar: PropTypes.bool,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string
    };
    state = {
        dontShowAgain: false,
        showPopup: false,
        side: 'right'
    };
    constructor(props) {
        super(props);
        const show = props.newsDocument && !!props.newsRev && !document.cookie.split(';').some((item) => item.includes('newsrev=' + props.newsRev));
        if (show) {
            if (props.showInSidebar) {
                props.setCurrentTask("NewsPopup");
            } else {
                this.state.showPopup = show;
            }
        }
    }
    render() {
        if (this.props.showInSidebar) {
            return (
                <SideBar heightResizeable icon="new" id="NewsPopup" side={this.props.side}
                    title={LocaleUtils.tr("newspopup.title")} width="20em"
                >
                    {this.renderBody()}
                </SideBar>
            );
        } else if (this.state.showPopup) {
            return (
                <div className="newspopup-dialog-container">
                    <div className="newspopup-dialog-popup">
                        <div className="newspopup-dialog-popup-title"><span>{LocaleUtils.tr("newspopup.title")}</span><Icon icon="remove" onClick={this.closeDialog} /></div>
                        {this.renderBody()}
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
    renderBody = () => {
        return (
            <div className="newspopup-dialog-popup-body" role="body">
                <iframe src={this.props.newsDocument} />
                <div className="newspopup-dialog-popup-buttonbar">
                    <button onClick={this.closeDialog}>{LocaleUtils.tr("newspopup.dialogclose")}</button>
                    <label><input onChange={ev => this.setState({dontShowAgain: ev.target.checked})} type="checkbox" value={this.state.dontShowAgain} /> {LocaleUtils.tr("newspopup.dontshowagain")}</label>
                </div>
            </div>
        );
    };
    closeDialog = () => {
        if (this.state.dontShowAgain) {
            const days = 365;
            const d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = "newsrev=" + this.props.newsRev + "; SameSite=Lax; expires=" + d.toUTCString();
        }
        if (this.props.showInSidebar) {
            this.props.setCurrentTask(null);
        } else {
            this.setState({showPopup: false});
        }
    };
}

export default connect(() => ({}), {
    setCurrentTask: setCurrentTask
})(NewsPopup);

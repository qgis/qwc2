/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';

import './style/CopyButton.css';


export default class CopyButton extends React.Component {
    static propTypes = {
        buttonClass: PropTypes.string,
        /* getClipboardData(callback({mimeType: blob}) */
        getClipboardData: PropTypes.func,
        /* Alternative to getClipboardData for plain text. */
        text: PropTypes.string,
        tooltipAlign: PropTypes.string
    };
    static defaultProps = {
        tooltipAlign: 'center'
    };
    state = {
        copied: null
    };
    render() {
        const tooltipStyle = {};
        if (this.props.tooltipAlign === "left") {
            tooltipStyle.left = '0';
        } else if (this.props.tooltipAlign === "right") {
            tooltipStyle.right = '0';
        } else {
            tooltipStyle.left = '50%';
            tooltipStyle.transform = 'translateX(-50%)';
        }
        let tooltipMessage = '';
        if (this.state.copied === false) {
            tooltipMessage = LocaleUtils.tr("copybtn.copyfailed");
        } else if (this.state.copied === true) {
            tooltipMessage = LocaleUtils.tr("copybtn.copied");
        } else {
            tooltipMessage = LocaleUtils.tr("copybtn.click_to_copy");
        }
        return (
            <span className="CopyButton">
                <button className={"button " + this.props.buttonClass} onClick={this.copyToClipboard} onMouseLeave={() => {this.setState({copied: null}); }} >
                    <Icon icon="copy"/>
                </button>
                <span className="copybutton-tooltip" style={tooltipStyle}>
                    {tooltipMessage}
                </span>
            </span>
        );
    }
    copyToClipboard = () => {
        if (this.props.getClipboardData) {
            this.props.getClipboardData((data) => {
                try {
                    const item = new ClipboardItem(data);
                    navigator.clipboard.write([item]);
                    this.setState({copied: true});
                } catch (e) {
                    this.setState({copied: false});
                }
            });
        } else if (this.props.text) {
            this.setState({copied: true});
            navigator.clipboard.writeText(this.props.text);
        }
    };
}

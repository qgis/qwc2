/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import withTooltip from '../../utils/Tooltip';
import Icon from '../Icon';


export default class CopyButton extends React.Component {
    static propTypes = {
        buttonClass: PropTypes.string,
        /* getClipboardData(callback({mimeType: blob}) */
        getClipboardData: PropTypes.func,
        /* Alternative to getClipboardData for plain text. */
        text: PropTypes.string
    };
    state = {
        copied: null
    };
    render() {
        let tooltipMessage = '';
        if (this.state.copied === false) {
            tooltipMessage = LocaleUtils.tr("copybtn.copyfailed");
        } else if (this.state.copied === true) {
            tooltipMessage = LocaleUtils.tr("copybtn.copied");
        } else {
            tooltipMessage = LocaleUtils.tr("copybtn.click_to_copy");
        }
        return (
            <button
                className={`button ${this.props.buttonClass}`} onClick={this.copyToClipboard} type="button"
                {...withTooltip(tooltipMessage, {onMouseLeave: () => this.setState({copied: null})})}
            >
                <Icon icon="copy"/>
            </button>
        );
    }
    copyToClipboard = () => {
        if (this.props.getClipboardData) {
            this.props.getClipboardData((data) => {
                try {
                    const item = new ClipboardItem(data);
                    navigator.clipboard.write([item]);
                    this.setState({copied: true});
                } catch {
                    this.setState({copied: false});
                }
            });
        } else if (this.props.text) {
            this.setState({copied: true});
            navigator.clipboard.writeText(this.props.text);
        }
    };
}

/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import CopyToClipboard from 'react-copy-to-clipboard';
import Icon from '../Icon';
import LocaleUtils from '../../utils/LocaleUtils';
import './style/CopyButton.css';

export default class CopyButton extends React.Component {
    static propTypes = {
        buttonClass: PropTypes.string,
        text: PropTypes.string,
        tooltipAlign: PropTypes.string
    }
    static defaultProps = {
        tooltipAlign: 'center'
    }
    state = {
        copied: false
    }
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
        return (
            <CopyToClipboard onCopy={ () => this.setState({copied: true}) } text={this.props.text} >
                <button className={"CopyButton button " + this.props.buttonClass} onMouseLeave={() => {this.setState({copied: false}); }} >
                    <Icon icon="copy"/>
                    <span className="copybutton-tooltip" style={tooltipStyle}>
                        {this.state.copied ? LocaleUtils.tr("copybtn.copied") : LocaleUtils.tr("copybtn.click_to_copy")}
                    </span>
                </button>
            </CopyToClipboard>
        );
    }
}

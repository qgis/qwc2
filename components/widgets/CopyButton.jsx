/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const CopyToClipboard = require('react-copy-to-clipboard');
const Icon = require('../Icon');
const Message = require('../../components/I18N/Message');
require('./style/CopyButton.css');

class CopyButton extends React.Component {
    static propTypes = {
        text: PropTypes.string,
        buttonClass: PropTypes.string,
        tooltipAlign: PropTypes.string
    }
    static defaultProps = {
        tooltipAlign: 'center'
    }
    state = {
        copied: false
    }
    render() {
        let tooltipStyle = {};
        if(this.props.tooltipAlign === "left") {
            tooltipStyle.left = '0';
        } else if(this.props.tooltipAlign === "right") {
            tooltipStyle.right = '0';
        } else {
            tooltipStyle.left = '50%';
            tooltipStyle.transform = 'translateX(-50%)';
        };
        return (
            <CopyToClipboard text={this.props.text} onCopy={ () => this.setState({copied: true}) } >
                <span className={"CopyButton " + this.props.buttonClass} onMouseLeave={() => {this.setState({copied: false}); }} >
                    <Icon icon="copy"/>
                    <span className="copybutton-tooltip" style={tooltipStyle}>
                        <Message msgId={this.state.copied ? "copybtn.copied" : "copybtn.click_to_copy"}/>
                    </span>
                </span>
            </CopyToClipboard>
        );
    }
}

module.exports = CopyButton;

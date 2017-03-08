/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const CopyToClipboard = require('react-copy-to-clipboard');
const {Glyphicon, Tooltip, OverlayTrigger} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
require('./style/ShareLink.css');

const ShareLink = React.createClass({
    propTypes: {
        shareUrl: React.PropTypes.string
    },
    getInitialState() {
        return {copied: false};
    },
    render() {
        const tooltip = (
            <Tooltip placement="bottom" className="in" id="tooltip-bottom">
                {<Message msgId={this.state.copied ? "share.msgCopiedUrl" : "share.msgToCopyUrl"}/>}
            </Tooltip>
        );
        return (
            <div className="share-link">
                  <h4><Message msgId="share.directLinkTitle"/></h4>
                  <div className="share-link-frame">
                      <input onFocus={ev => ev.target.select()} type="text" value={this.props.shareUrl} readOnly/>
                      <OverlayTrigger placement="bottom" overlay={tooltip}>
                          <CopyToClipboard text={this.props.shareUrl} onCopy={ () => this.setState({copied: true}) } >
                              <span className="share-link-button" onMouseLeave={() => {this.setState({copied: false}); }} >
                                  <Glyphicon glyph="copy"/>
                              </span>
                          </CopyToClipboard>
                      </OverlayTrigger>
                  </div>
            </div>
        );
    }
});

module.exports = ShareLink;

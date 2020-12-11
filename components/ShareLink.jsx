/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const Message = require('../components/I18N/Message');
const CopyButton = require('./widgets/CopyButton');
require('./style/ShareLink.css');

class ShareLink extends React.Component {
    static propTypes = {
        shareUrl: PropTypes.string
    }
    render() {
        return (
            <div className="share-link">
                <h4><Message msgId="share.directLinkTitle"/></h4>
                <div className="share-link-frame">
                    <input onFocus={ev => ev.target.select()} readOnly type="text" value={this.props.shareUrl} />
                    <CopyButton buttonClass="share-link-button" text={this.props.shareUrl} tooltipAlign="right" />
                </div>
            </div>
        );
    }
}

module.exports = ShareLink;

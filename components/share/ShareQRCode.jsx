/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const QRCode = require('qrcode.react');
const Message = require('../../components/I18N/Message');

class ShareQRCode extends React.Component {
    static propTypes = {
        shareUrl: PropTypes.string
    }
    render() {
        return (
            <div className="qr-code">
                <h4>
                    <Message msgId="share.QRCodeLinkTitle"/>
                </h4>
                <QRCode value={this.props.shareUrl} />
            </div>
        );
    }
}

module.exports = ShareQRCode;

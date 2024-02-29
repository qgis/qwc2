/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';
import {QRCodeCanvas} from 'qrcode.react';

import LocaleUtils from '../../utils/LocaleUtils';
import CopyButton from '../widgets/CopyButton';

export default class ShareQRCode extends React.Component {
    static propTypes = {
        shareUrl: PropTypes.string
    };
    render() {
        const canCopy = navigator.clipboard.write !== undefined;
        return (
            <div className="qr-code">
                <h4>
                    {LocaleUtils.tr("share.QRCodeLinkTitle")}
                </h4>
                {canCopy ? (<CopyButton buttonClass="qr-code-copy-button" getClipboardData={this.getClipboardData} />) : null}
                <br />
                <QRCodeCanvas id="qwc2-share-qr-canvas" size={128} value={this.props.shareUrl} />
            </div>
        );
    }
    getClipboardData = (callback) => {
        document.getElementById("qwc2-share-qr-canvas").toBlob((blob) => callback({"image/png": blob}));
    };
}

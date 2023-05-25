/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import LocaleUtils from '../../utils/LocaleUtils';

export default class ShareQRCode extends React.Component {
    static propTypes = {
        shareUrl: PropTypes.string
    };
    render() {
        return (
            <div className="qr-code">
                <h4>
                    {LocaleUtils.tr("share.QRCodeLinkTitle")}
                </h4>
                <QRCode value={this.props.shareUrl} />
            </div>
        );
    }
}

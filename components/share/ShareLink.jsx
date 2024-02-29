/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import CopyButton from '../widgets/CopyButton';

import './style/ShareLink.css';

export default class ShareLink extends React.Component {
    static propTypes = {
        shareUrl: PropTypes.string
    };
    render() {
        return (
            <div className="share-link">
                <h4>{LocaleUtils.tr("share.directLinkTitle")}</h4>
                <div className="share-link-frame">
                    <input onFocus={ev => ev.target.select()} readOnly type="text" value={this.props.shareUrl} />
                    <CopyButton buttonClass="share-link-button" text={this.props.shareUrl} tooltipAlign="right" />
                </div>
            </div>
        );
    }
}

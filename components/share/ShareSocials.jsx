/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import {
    FacebookShareButton,
    LinkedinShareButton,
    TwitterShareButton,
    WhatsappShareButton,
    EmailShareButton,
    FacebookShareCount,
    FacebookIcon,
    TwitterIcon,
    LinkedinIcon,
    WhatsappIcon,
    EmailIcon
} from 'react-share';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';

import './style/ShareSocials.css';


export default class ShareSocials extends React.Component {
    static propTypes = {
        getCount: PropTypes.func,
        shareTitle: PropTypes.string,
        shareUrl: PropTypes.string,
        showSocials: PropTypes.oneOfType([PropTypes.bool, PropTypes.array])
    };
    static defaultProps = {
        shareTitle: 'GeoSolutions'
    };
    render() {
        const countProps = {};
        if (this.props.getCount) {
            countProps.getCount = this.props.getCount;
        }
        const title = this.props.shareTitle;
        const url = this.props.shareUrl;

        const socialTypes = {
            email: (
                <div className="social-box" key="email">
                    <EmailShareButton subject={title} url={url}>
                        <EmailIcon round size={32} />
                    </EmailShareButton>
                    <div>
                        &nbsp;
                    </div>
                </div>
            ),
            facebook: (
                <div className="social-box" key="facebook">
                    <FacebookShareButton quote={title} url={url}>
                        <FacebookIcon round size={32} />
                    </FacebookShareButton>
                    <FacebookShareCount url={url} {...countProps}>
                        {count => count}
                    </FacebookShareCount>
                </div>
            ),
            twitter: (
                <div className="social-box" key="twitter">
                    <TwitterShareButton title={title} url={url}>
                        <TwitterIcon round size={32} />
                    </TwitterShareButton>
                    <div>
                        &nbsp;
                    </div>
                </div>
            ),
            linkedin: (
                <div className="social-box" key="linkedin">
                    <LinkedinShareButton title={title} url={url}>
                        <LinkedinIcon round size={32} />
                    </LinkedinShareButton>
                    <div>
                        &nbsp;
                    </div>
                </div>
            ),
            whatsapp: (
                <div className="social-box" key="whatsapp">
                    <WhatsappShareButton title={title} url={url}>
                        <WhatsappIcon round size={32} />
                    </WhatsappShareButton>
                    <div>
                        &nbsp;
                    </div>
                </div>
            )
        };
        let socialBoxes = [];
        if (this.props.showSocials === true) {
            socialBoxes = Object.values(socialTypes);
        } else {
            this.props.showSocials.map(name => {
                if (name in socialTypes) {
                    socialBoxes.push(socialTypes[name]);
                } else {
                    // eslint-disable-next-line
                    console.warn("`%s` is not a valid social network", name);
                }
            });
        }

        return (
            <div className="social-links">
                <h4>
                    {LocaleUtils.tr("share.socialIntro")}
                </h4>
                <div className="social-boxes">
                    {socialBoxes}
                </div>
            </div>
        );
    }
}

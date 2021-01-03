/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import Message from '../../components/I18N/Message';
import {
    FacebookShareButton,
    LinkedinShareButton,
    TwitterShareButton,
    WhatsappShareButton,
    FacebookShareCount,
    FacebookIcon,
    TwitterIcon,
    LinkedinIcon,
    WhatsappIcon
} from 'react-share';
import './style/ShareSocials.css';


export default class ShareSocials extends React.Component {
    static propTypes = {
        getCount: PropTypes.func,
        shareTitle: PropTypes.string,
        shareUrl: PropTypes.string
    }
    static defaultProps = {
        shareTitle: 'GeoSolutions'
    }
    render() {
        const countProps = {};
        if (this.props.getCount) {
            countProps.getCount = this.props.getCount;
        }
        const title = this.props.shareTitle;

        return (
            <div className="social-links">
                <h4>
                    <Message msgId="share.socialIntro"/>
                </h4>
                <div className="social-boxes">
                    <div className="social-box">
                        <FacebookShareButton quote={title} url={this.props.shareUrl}>
                            <FacebookIcon round size={32} />
                        </FacebookShareButton>
                        <FacebookShareCount url={this.props.shareUrl} {...countProps}>
                            {count => count}
                        </FacebookShareCount>
                    </div>

                    <div className="social-box">
                        <TwitterShareButton title={title} url={this.props.shareUrl}>
                            <TwitterIcon round size={32} />
                        </TwitterShareButton>
                        <div>
                            &nbsp;
                        </div>
                    </div>

                    <div className="social-box">
                        <LinkedinShareButton title={title} url={this.props.shareUrl}>
                            <LinkedinIcon round size={32} />
                        </LinkedinShareButton>
                        <div>
                            &nbsp;
                        </div>
                    </div>

                    <div className="social-box">
                        <WhatsappShareButton title={title} url={this.props.shareUrl}>
                            <WhatsappIcon round size={32} />
                        </WhatsappShareButton>
                        <div>
                            &nbsp;
                        </div>
                    </div>

                </div>
            </div>
        );
    }
}

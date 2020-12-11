/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const Message = require('../../components/I18N/Message');
const {
    FacebookShareButton,
    LinkedinShareButton,
    TwitterShareButton,
    FacebookShareCount,
    FacebookIcon,
    TwitterIcon,
    LinkedinIcon
} = require('react-share');
require('./share.css');


class ShareSocials extends React.Component {
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
                    <div className="social-box facebook">
                        <FacebookShareButton className="share-facebook" quote={title} url={this.props.shareUrl}>
                            <FacebookIcon round size={32} />
                        </FacebookShareButton>
                        <FacebookShareCount className="share-facebook-count" url={this.props.shareUrl} {...countProps}>
                            {count => count}
                        </FacebookShareCount>
                    </div>

                    <div className="social-box twitter">
                        <TwitterShareButton className="share-twitter" title={title} url={this.props.shareUrl}>
                            <TwitterIcon round size={32} />
                        </TwitterShareButton>
                        <div className="share-twitter-count">
                            &nbsp;
                        </div>
                    </div>

                    <div className="social-box linkedin">
                        <LinkedinShareButton className="share-linkedin-count" title={title} url={this.props.shareUrl}>
                            <LinkedinIcon round size={32} />
                        </LinkedinShareButton>
                        <div className="linkedin-twitter-count">
                            &nbsp;
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = ShareSocials;

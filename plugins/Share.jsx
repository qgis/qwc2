/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import Message from '../components/I18N/Message';
import ShareSocials from '../components/share/ShareSocials';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareLink from '../components/share/ShareLink';
import SideBar from '../components/SideBar';
import {generatePermaLink} from '../utils/PermaLinkUtils';
import './style/Share.css';

class Share extends React.Component {
    static propTypes = {
        showLink: PropTypes.bool,
        showQRCode: PropTypes.bool,
        showSocials: PropTypes.bool,
        state: PropTypes.object
    }
    static defaultProps = {
        showSocials: true,
        showLink: true,
        showQRCode: true
    }
    state = {
        location: null
    }
    onShow = () => {
        this.setState({location: null});
        generatePermaLink(this.props.state, (permalink => this.setState({location: permalink})));
    }
    renderBody = () => {
        if (this.state.location) {
            const shareSocials = this.props.showSocials ? <ShareSocials shareTitle="QWC2" shareUrl={this.state.location}/> : null;
            const shareLink = this.props.showLink ? <ShareLink shareUrl={this.state.location}/> : null;
            const shareQRCode = this.props.showQRCode ? <ShareQRCode shareUrl={this.state.location}/> : null;
            return (
                <div>
                    {shareSocials}
                    {shareLink}
                    {shareQRCode}
                </div>
            );
        } else {
            return (
                <div style={{padding: "1em"}}>
                    <Message msgId="share.generatingpermalink" />
                </div>);
        }
    }
    render() {
        return (
            <SideBar icon="share" id="Share" onShow={this.onShow}
                title="appmenu.items.Share" width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
}

export default connect(state => ({state}))(Share);

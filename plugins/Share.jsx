/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const PropTypes = require('prop-types');
const Message = require('../components/I18N/Message');
const ShareSocials = require('../components/share/ShareSocials');
const ShareQRCode = require('../components/share/ShareQRCode');
const ConfigUtils = require('../utils/ConfigUtils');
const ShareLink = require('../components/ShareLink');
const {SideBar} = require('../components/SideBar');
const {generatePermaLink} = require('../utils/PermaLinkUtils');
require('./style/Share.css');

class Share extends React.Component {
    static propTypes = {
        showSocials: PropTypes.bool,
        showLink: PropTypes.bool,
        showQRCode: PropTypes.bool,
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
        if(this.state.location) {
            const shareSocials = this.props.showSocials ? <ShareSocials shareUrl={this.state.location} shareTitle="QWC2" getCount={this.props.getCount}/> : null;
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
            <SideBar id="Share" onShow={this.onShow} width="20em"
                title="appmenu.items.Share" icon="share">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
};

module.exports = {
    SharePlugin: connect(state => ({state}))(Share),
    reducers: {
        task: require('../reducers/task')
    }
}

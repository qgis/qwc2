/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react')
const axios = require('axios');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ShareSocials = require('../../MapStore2/web/client/components/share/ShareSocials');
const ShareLink = require('../../MapStore2/web/client/components/share/ShareLink');
const ShareEmbed = require('../../MapStore2/web/client/components/share/ShareEmbed');
const ShareQRCode = require('../../MapStore2/web/client/components/share/ShareQRCode');
const ConfigUtils = require('../../MapStore2/web/client/utils/ConfigUtils');
const {SideBar} = require('../components/SideBar');
require('./style/Share.css');

const Share = React.createClass({
    propTypes: {
    },
    getDefaultProps() {
        return {
        }
    },
    getInitialState() {
        return {location: null};
    },
    onShow() {
        this.setState({location: null});
        fetch(ConfigUtils.getConfigProp("qwc2serverUrl") + "/createpermalink?url=" + encodeURIComponent(window.location.href))
            .then(response => response.json())
            .then(obj => this.setState({location: obj.permalink}));
    },
    renderBody() {
        if(this.state.location) {
            return (
                <div role="body" className="scrollable">
                    <ShareSocials shareUrl={this.state.location} shareTitle="QWC2" getCount={this.props.getCount}/>
                    <ShareLink shareUrl={this.state.location}/>
                    <ShareQRCode shareUrl={this.state.location}/>
                </div>
            );
        } else {
            return (
                <div style={{padding: "1em"}} role="body">
                    <Message msgId="share.generatingpermalink" />
                </div>);
        }
    },
    render() {
        return (
            <SideBar id="Share" onShow={this.onShow} width="20em" title="share.title">
                {this.renderBody()}
            </SideBar>
        );
    }
});

module.exports = {
    SharePlugin: Share,
    reducers: {
        sidebar: require('../reducers/sidebar')
    }
}

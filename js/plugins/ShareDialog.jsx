/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {Glyphicon} = require('react-bootstrap');
const {connect} = require('react-redux');
const axios = require('axios');
const Dialog = require('../../MapStore2/web/client/components/misc/Dialog');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ShareSocials = require('../../MapStore2/web/client/components/share/ShareSocials');
const ShareLink = require('../../MapStore2/web/client/components/share/ShareLink');
const ShareEmbed = require('../../MapStore2/web/client/components/share/ShareEmbed');
const ShareQRCode = require('../../MapStore2/web/client/components/share/ShareQRCode');
const ConfigUtils = require('../../MapStore2/web/client/utils/ConfigUtils');
const {changeDialogState} = require('../actions/dialog');
require('./style/Dialog.css');
require('./style/ShareDialog.css');

const ShareDialog = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        changeDialogState: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false
        }
    },
    getInitialState() {
        return {location: null};
    },
    onClose() {
        this.props.changeDialogState({share: false});
    },
    componentWillReceiveProps(newProps) {
        if(newProps.visible && newProps.visible !== this.props.visible) {
            this.setState({location: null});
            fetch(ConfigUtils.getConfigProp("qwc2serverUrl") + "/createpermalink?url=" + encodeURIComponent(window.location.href))
            .then(response => response.json())
            .then(obj => this.setState({location: obj.permalink}));
        }
    },
    renderHeader() {
        return (
            <div className="dialogheader" role="header">
                <span className="dialogtitle"><Message msgId="sharedialog.title" /></span>
                <span className="dialogclose" onClick={this.onClose}><Glyphicon glyph="remove"/></span>
            </div>
        );
    },
    renderBody() {
        if(this.state.location) {
            return (
                <div role="body" className="share-panels">
                    <ShareSocials shareUrl={this.state.location} shareTitle="QWC2" getCount={this.props.getCount}/>
                    <ShareLink shareUrl={this.state.location}/>
                    <ShareQRCode shareUrl={this.state.location}/>
                </div>
            );
        } else {
            return (
                <div role="body" className="share-panels" style={{padding: "1em"}}>
                    <Message msgId="sharedialog.generatingpermalink" />
                </div>);
        }
    },
    render() {
        if(!this.props.visible) {
            return null;
        }
        return (
            <Dialog id="ShareLinkDialog" headerClassName="" bodyClassName="">
                {this.renderHeader()}
                {this.renderBody()}
            </Dialog>
        );
    },
});

const selector = (state) => ({
    visible: state.dialogs && state.dialogs.share
});

module.exports = {
    ShareDialogPlugin: connect(selector, {
        changeDialogState: changeDialogState
    })(ShareDialog),
    reducers: {
        dialogs: require('../reducers/dialog')
    }
}

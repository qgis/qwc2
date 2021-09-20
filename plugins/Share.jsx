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
import {addMarker, removeMarker} from '../actions/layers';
import ShareSocials from '../components/share/ShareSocials';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareLink from '../components/share/ShareLink';
import SideBar from '../components/SideBar';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import LocaleUtils from '../utils/LocaleUtils';
import {generatePermaLink} from '../utils/PermaLinkUtils';
import './style/Share.css';

class Share extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
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
        location: null,
        pin: false
    }
    componentDidUpdate(prevProps, prevState) {
        const isVisible = this.props.state.task.id === "Share";
        const wasVisible = prevProps.state.task.id === "Share";
        if (isVisible !== wasVisible || this.state.pin !== prevState.pin || this.props.state.map.center !== prevProps.state.map.center) {
            if (isVisible && this.state.pin) {
                this.props.addMarker('sharecenter', this.props.state.map.center, '', this.props.state.map.projection);
            } else {
                this.props.removeMarker('sharecenter');
            }
        }
    }
    onShow = () => {
        this.setState({location: null});
        generatePermaLink(this.props.state, (permalink => this.setState({location: permalink})));
    }
    renderBody = () => {
        if (this.state.location) {
            let url = this.state.location;
            if (this.state.pin) {
                url += url.includes("?") ? "&hc=1" : "?hc=1";
            }
            const shareSocials = this.props.showSocials ? <ShareSocials shareTitle="QWC2" shareUrl={url}/> : null;
            const shareLink = this.props.showLink ? <ShareLink shareUrl={url}/> : null;
            const shareQRCode = this.props.showQRCode ? <ShareQRCode shareUrl={url}/> : null;
            return (
                <div>
                    <div className="share-option-pin">
                        <span>{LocaleUtils.tr("share.showpin")}</span>
                        <ToggleSwitch active={this.state.pin} onChange={active => this.setState({pin: active})} />
                    </div>
                    {shareSocials}
                    {shareLink}
                    {shareQRCode}
                </div>
            );
        } else {
            return (
                <div style={{padding: "1em"}}>
                    {LocaleUtils.tr("share.generatingpermalink")}
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

export default connect(state => ({
    state
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(Share);

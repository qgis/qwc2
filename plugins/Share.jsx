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
import url from 'url';
import {addMarker, removeMarker} from '../actions/layers';
import ShareSocials from '../components/share/ShareSocials';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareLink from '../components/share/ShareLink';
import SideBar from '../components/SideBar';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import LocaleUtils from '../utils/LocaleUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {generatePermaLink} from '../utils/PermaLinkUtils';
import './style/Share.css';

class Share extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
        showLink: PropTypes.bool,
        showQRCode: PropTypes.bool,
        showSocials: PropTypes.bool,
        side: PropTypes.string,
        state: PropTypes.object
    }
    static defaultProps = {
        showSocials: true,
        showLink: true,
        showQRCode: true,
        side: 'right'
    }
    state = {
        location: "",
        pin: false
    }
    componentDidUpdate(prevProps, prevState) {
        const isVisible = this.props.state.task.id === "Share";
        const wasVisible = prevProps.state.task.id === "Share";
        if (isVisible !== wasVisible || this.state.pin !== prevState.pin || this.props.state.map.center !== prevProps.state.map.center) {
            if (isVisible && this.state.pin) {
                this.props.addMarker('sharecenter', this.props.state.map.center, '', this.props.state.map.projection);
            } else if (wasVisible) {
                this.props.removeMarker('sharecenter');
            }
        }
        if (isVisible !== wasVisible || this.props.state.map.center !== prevProps.state.map.center) {
            this.setState({location: ""});
        }
    }
    renderBody = () => {
        let shareUrl = this.state.location || 'about:blank';
        if (this.state.pin && this.state.location) {
            const urlParts = url.parse(shareUrl, true);
            urlParts.query.hc = 1;
            if (!urlParts.query.c) {
                const posCrs = urlParts.query.crs || this.props.state.map.projection;
                const prec = CoordinatesUtils.getUnits(posCrs) === 'degrees' ? 4 : 0;
                urlParts.query.c = this.props.state.map.center.map(x => x.toFixed(prec)).join(",");
            }
            delete urlParts.search;
            shareUrl = url.format(urlParts);
        }
        const shareSocials = this.props.showSocials ? <ShareSocials shareTitle="QWC2" shareUrl={shareUrl}/> : null;
        const shareLink = this.props.showLink ? <ShareLink shareUrl={shareUrl}/> : null;
        const shareQRCode = this.props.showQRCode ? <ShareQRCode shareUrl={shareUrl}/> : null;
        return (
            <div>
                <div className="share-option-pin">
                    <span>{LocaleUtils.tr("share.showpin")}</span>
                    <ToggleSwitch active={this.state.pin} onChange={active => this.setState({pin: active})} />
                </div>
                <div className="share-body">
                    {shareSocials}
                    {shareLink}
                    {shareQRCode}
                    {!this.state.location ? (
                        <div className="share-reload-overlay">
                            <button className="button" onClick={this.refreshPermalink}>{LocaleUtils.tr("share.refresh")}</button>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
    render() {
        return (
            <SideBar icon="share" id="Share" onShow={this.onShow} side={this.props.side}
                title="appmenu.items.Share" width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    refreshPermalink = () => {
        generatePermaLink(this.props.state, (permalink => {
            this.setState({location: permalink});
        }));
    }
}

export default connect(state => ({
    state
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(Share);

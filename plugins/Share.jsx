/**
 * Copyright 2016-2024 Sourcepole AG
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
import SideBar from '../components/SideBar';
import ShareLink from '../components/share/ShareLink';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareSocials from '../components/share/ShareSocials';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {generatePermaLink} from '../utils/PermaLinkUtils';

import './style/Share.css';


/**
 * Share the current map as a URL/permalink.
 *
 * Compact permalinks will be generated if `permalinkServiceUrl` in `config.json` points to a `qwc-permalink-service`.
 */
class Share extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func,
        /** Show the map URL. */
        showLink: PropTypes.bool,
        /** Show the QR code of the map URL. */
        showQRCode: PropTypes.bool,
        /** Show the social buttons. Either `true` or `false`to enable/disable all, or an array of specific buttons to display (possible choices: `email`, `facebook`, `twitter`, `linkedin`, `whatsapp`). */
        showSocials: PropTypes.oneOfType([PropTypes.bool, PropTypes.arrayOf(PropTypes.string)]),
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        state: PropTypes.object
    };
    static defaultProps = {
        showSocials: true,
        showLink: true,
        showQRCode: true,
        side: 'right'
    };
    state = {
        location: "",
        expires: null,
        pin: false
    };
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
            this.setState({location: "", expires: null});
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
        const shareSocials = this.props.showSocials !== false ? <ShareSocials shareTitle={LocaleUtils.tr("share.shareTitle")} shareUrl={shareUrl} showSocials={this.props.showSocials}/> : null;
        const shareLink = this.props.showLink ? <ShareLink shareUrl={shareUrl}/> : null;
        const shareQRCode = this.props.showQRCode ? <ShareQRCode shareUrl={shareUrl}/> : null;
        return (
            <div>
                <div className="share-option-pin">
                    <span>{LocaleUtils.tr("share.showpin")}</span>
                    <ToggleSwitch active={this.state.pin} onChange={active => this.setState({pin: active})} />
                </div>
                {!this.state.location ? (
                    <div className="share-reload-overlay">
                        <button className="button" onClick={this.refreshPermalink}>{LocaleUtils.tr("share.refresh")}</button>
                    </div>
                ) : (
                    <div className="share-body">
                        {shareSocials}
                        {shareLink}
                        {shareQRCode}
                        {this.state.expires ? (
                            <div className="share-validity">{LocaleUtils.tr("share.expires", this.state.expires)}</div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };
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
        generatePermaLink(this.props.state, ((permalink, expires) => {
            this.setState({location: permalink, expires: expires});
        }));
    };
}

export default connect(state => ({
    state
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(Share);

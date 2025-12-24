/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import url from 'url';

import {ViewMode} from '../actions/display';
import {addMarker, removeMarker} from '../actions/layers';
import SideBar from '../components/SideBar';
import ShareLink from '../components/share/ShareLink';
import ShareQRCode from '../components/share/ShareQRCode';
import ShareSocials from '../components/share/ShareSocials';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ConfigUtils from '../utils/ConfigUtils';
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
    static availableIn3D = true;

    static propTypes = {
        addMarker: PropTypes.func,
        currentTask: PropTypes.string,
        map: PropTypes.object,
        removeMarker: PropTypes.func,
        /** List of groups for which a permalink may optionally be restricted (only displayed for a logged-in user). */
        restrictableGroups: PropTypes.array,
        /** Show the map URL. */
        showLink: PropTypes.bool,
        /** Show the QR code of the map URL. */
        showQRCode: PropTypes.bool,
        /** Show the social buttons. Either `true` or `false`to enable/disable all, or an array of specific buttons to display (possible choices: `email`, `facebook`, `twitter`, `linkedin`, `whatsapp`). */
        showSocials: PropTypes.oneOfType([PropTypes.bool, PropTypes.arrayOf(PropTypes.string)]),
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        viewMode: PropTypes.number
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
        pin: false,
        permittedGroup: ""
    };
    componentDidUpdate(prevProps, prevState) {
        const isVisible = this.props.currentTask === "Share";
        const wasVisible = prevProps.currentTask === "Share";
        if (this.props.map && isVisible !== wasVisible || this.state.pin !== prevState.pin || this.props.map.center !== prevProps.map.center) {
            if (isVisible && this.state.pin) {
                this.props.addMarker('sharecenter', this.props.map.center, '', this.props.map.projection);
            } else if (wasVisible) {
                this.props.removeMarker('sharecenter');
            }
        }
        if (isVisible !== wasVisible || this.props.map.center !== prevProps.map.center) {
            this.setState({location: "", expires: null});
        }
    }
    renderBody = () => {
        let shareUrl = this.state.location || 'about:blank';
        if (this.state.pin && this.state.location) {
            const urlParts = url.parse(shareUrl, true);
            urlParts.query.hc = 1;
            if (!urlParts.query.c) {
                const posCrs = urlParts.query.crs || this.props.map.projection;
                const prec = CoordinatesUtils.getPrecision(posCrs);
                urlParts.query.c = this.props.map.center.map(x => x.toFixed(prec)).join(",");
            }
            delete urlParts.search;
            shareUrl = url.format(urlParts);
        }
        const shareSocials = this.props.showSocials !== false ? <ShareSocials shareTitle={LocaleUtils.tr("share.shareTitle")} shareUrl={shareUrl} showSocials={this.props.showSocials}/> : null;
        const shareLink = this.props.showLink ? <ShareLink shareUrl={shareUrl}/> : null;
        const shareQRCode = this.props.showQRCode ? <ShareQRCode shareUrl={shareUrl}/> : null;
        const username = ConfigUtils.getConfigProp("username");
        return (
            <div>
                {this.props.viewMode !== ViewMode._3DFullscreen && ConfigUtils.havePlugin("StartupMarker") ? (
                    <div className="share-option-pin">
                        <span>{LocaleUtils.tr("share.showpin")}</span>
                        <ToggleSwitch active={this.state.pin} onChange={active => this.setState({pin: active})} />
                    </div>
                ) : null}
                {!this.state.location ? (
                    <div className="share-reload-overlay">
                        <div>
                            <button className="button" onClick={this.refreshPermalink}>{LocaleUtils.tr("share.refresh")}</button>
                        </div>
                        {username && !isEmpty(this.props.restrictableGroups) ? (
                            <div className="share-group-restriction">
                                <span>{LocaleUtils.tr("share.restricttogroup")}: </span>
                                <select onChange={ev => this.setState({permittedGroup: ev.target.value})} value={this.state.permittedGroup}>
                                    <option value="">{LocaleUtils.tr("share.norestriction")}</option>
                                    {this.props.restrictableGroups.map(entry => (
                                        <option key={entry} value={entry}>{entry}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

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
                title={LocaleUtils.tr("appmenu.items.Share")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    refreshPermalink = () => {
        generatePermaLink(((permalink, expires) => {
            this.setState({location: permalink, expires: expires, permittedGroup: ""});
        }), false, this.state.permittedGroup);
    };
}

export default connect(state => ({
    currentTask: state.task.id,
    map: state.map,
    viewMode: state.display.viewMode
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(Share);

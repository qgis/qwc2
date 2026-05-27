/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {openExternalUrl, setBottombarHeight} from '../../actions/windows';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/BottomBar3D.css';


/**
 * Bottom bar of the 3D map, displaying coordinates, projection, etc.
 */
class BottomBar3D extends React.Component {
    static propTypes = {
        /** Additional bottombar links.`side` can be `left` or `right` (default). */
        additionalBottomBarLinks: PropTypes.arrayOf(PropTypes.shape({
            label: PropTypes.string,
            labelMsgId: PropTypes.string,
            side: PropTypes.string,
            url: PropTypes.string,
            urlTarget: PropTypes.string,
            icon: PropTypes.string
        })),
        /** Whether to display the coordinates in the bottom bar. */
        displayCoordinates: PropTypes.bool,
        fullscreen: PropTypes.bool,
        openExternalUrl: PropTypes.func,
        sceneContext: PropTypes.object,
        setBottombarHeight: PropTypes.func,
        /** The URL of the terms label anchor. */
        termsUrl: PropTypes.string,
        /** Icon of the terms inline window. Relevant only when `termsUrlTarget` is `iframe`. */
        termsUrlIcon: PropTypes.string,
        /** The target where to open the terms URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. */
        termsUrlTarget: PropTypes.string,
        /** The URL of the viewer title label anchor. */
        viewertitleUrl: PropTypes.string,
        /** Icon of the viewer title inline window. Relevant only when `viewertitleUrl` is `iframe`. */
        viewertitleUrlIcon: PropTypes.string,
        /** The target where to open the viewer title URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. */
        viewertitleUrlTarget: PropTypes.string
    };
    static defaultProps = {
        displayCoordinates: true
    };
    state = {
        cursorPosition: null,
        progress: 0
    };
    componentDidMount() {
        this.props.sceneContext.scene.viewport.addEventListener('mousemove', this.scheduleGetCursorPosition);
        this.props.sceneContext.scene.addEventListener("update-end", () => {
            this.setState({progress: Math.round(this.props.sceneContext.scene.progress * 100) + "%"});
        });
    }
    componentWillUnmount() {
        clearTimeout(this.cursorPositionTimeout);
    }
    render() {
        if (this.props.fullscreen) {
            return null;
        }
        const leftBottomLinks = (this.props.additionalBottomBarLinks || []).filter(entry => entry.side === "left").map(this.renderLink);
        const rightBottomLinks = (this.props.additionalBottomBarLinks || []).filter(entry => entry.side !== "left").map(this.renderLink);
        if (this.props.viewertitleUrl) {
            const entry = {url: this.props.viewertitleUrl, urlTarget: this.props.viewertitleUrlTarget, label: LocaleUtils.tr("bottombar.viewertitle_label"), icon: this.props.viewertitleUrlIcon};
            rightBottomLinks.push(this.renderLink(entry));
        }
        if (this.props.termsUrl) {
            const entry = {url: this.props.termsUrl, urlTarget: this.props.termsUrlTarget, label: LocaleUtils.tr("bottombar.terms_label"), icon: this.props.termsUrlIcon};
            rightBottomLinks.push(this.renderLink(entry));
        }
        let position = null;
        let projection = null;
        if (this.props.displayCoordinates) {
            position = (
                <div className="map3d-bottombar-position">
                    {(this.state.cursorPosition || []).map(x => x.toFixed(0)).join(" ")}
                </div>
            );
            projection = (
                <div className="map3d-bottombar-projection">
                    {this.props.sceneContext.mapCrs ? CoordinatesUtils.getAvailableCRS()[this.props.sceneContext.mapCrs].label : ""}
                </div>
            );
        }
        return (
            <div className="map3d-bottombar" ref={this.storeHeight}>
                <div className="map3d-bottombar-progress">
                    <div className="map3d-bottombar-progressbar" style={{width: this.state.progress}} />
                    <div className="map3d-bottombar-progress-label">{this.state.progress}</div>
                </div>
                <span className="bottombar-links">
                    {leftBottomLinks}
                </span>
                <div className="map3d-bottombar-spacer" />
                {position}
                {projection}
                <div className="map3d-bottombar-spacer" />
                <span className="bottombar-links">
                    {rightBottomLinks}
                </span>
            </div>
        );
    }
    renderLink = (entry) => {
        return (
            <a href={entry.url} key={entry.labelMsgId ?? entry.label} onClick={(ev) => this.openUrl(ev, entry.url, entry.urlTarget, entry.labelMsgId ? LocaleUtils.tr(entry.labelMsgId) : entry.label, entry.icon)}>
                <span className="extra_label">{entry.labelMsgId ? LocaleUtils.tr(entry.labelMsgId) : entry.label}</span>
            </a>
        );
    };
    openUrl = (ev, url, target, title, icon) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title, icon});
        ev.preventDefault();
    };
    scheduleGetCursorPosition = (ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width * 2 - 1;
        const y = -(ev.clientY - rect.top) / rect.height * 2 + 1;
        clearTimeout(this.cursorPositionTimeout);
        this.cursorPositionTimeout = setTimeout(() => this.getCursorPosition(x, y), 150);
    };
    getCursorPosition = (x, y) => {
        const intersection = this.props.sceneContext.getSceneIntersection(x, y);
        if (intersection) {
            const p = intersection.point;
            this.setState({cursorPosition: [p.x, p.y, p.z]});
        }
    };
    storeHeight = (el) => {
        if (el) {
            this.props.setBottombarHeight(el.clientHeight);
        }
    };
}

export default connect((state) => ({
    fullscreen: state.display?.fullscreen
}), {
    openExternalUrl: openExternalUrl,
    setBottombarHeight: setBottombarHeight
})(BottomBar3D);

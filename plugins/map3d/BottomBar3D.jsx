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

import {ViewMode} from '../../actions/display';
import {openExternalUrl, setBottombarHeight} from '../../actions/windows';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/BottomBar3D.css';


/**
 * Bottom bar of the 3D map, displaying coordinates, projection, etc.
 */
class BottomBar3D extends React.Component {
    static propTypes = {
        /** Whether to display the coordinates in the bottom bar. */
        displayCoordinates: PropTypes.bool,
        fullscreen: PropTypes.bool,
        openExternalUrl: PropTypes.func,
        sceneContext: PropTypes.object,
        setBottombarHeight: PropTypes.func,
        viewMode: PropTypes.number
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
        const bottomBarConfig = ConfigUtils.getPluginConfig("BottomBar")?.cfg ?? {};
        const leftBottomLinks = (bottomBarConfig.additionalBottomBarLinks || []).filter(entry => entry.side === "left").map(this.renderLink);
        const rightBottomLinks = (bottomBarConfig.additionalBottomBarLinks || []).filter(entry => entry.side !== "left").map(this.renderLink);
        if (bottomBarConfig.viewertitleUrl) {
            const entry = {url: bottomBarConfig.viewertitleUrl, urlTarget: bottomBarConfig.viewertitleUrlTarget, label: LocaleUtils.tr("bottombar.viewertitle_label"), icon: bottomBarConfig.viewertitleUrlIcon};
            rightBottomLinks.push(this.renderLink(entry));
        }
        if (bottomBarConfig.termsUrl) {
            const entry = {url: bottomBarConfig.termsUrl, urlTarget: bottomBarConfig.termsUrlTarget, label: LocaleUtils.tr("bottombar.terms_label"), icon: bottomBarConfig.termsUrlIcon};
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
                {this.props.viewMode === ViewMode._3DFullscreen ? (
                    <span className="bottombar-links">
                        {leftBottomLinks}
                    </span>
                ) : null}
                <div className="map3d-bottombar-spacer" />
                {position}
                {projection}
                <div className="map3d-bottombar-spacer" />
                {this.props.viewMode === ViewMode._3DFullscreen ? (
                    <span className="bottombar-links">
                        {rightBottomLinks}
                    </span>
                ) : null}
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
    fullscreen: state.display?.fullscreen,
    viewMode: state.display?.viewMode
}), {
    openExternalUrl: openExternalUrl,
    setBottombarHeight: setBottombarHeight
})(BottomBar3D);
